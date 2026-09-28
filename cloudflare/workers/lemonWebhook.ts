/**
 * Lemon Squeezy billing webhook (`POST /api/webhook/lemonsqueezy`).
 *
 * - Fails closed: without the HMAC secret nothing is processed; unsigned or
 *   tampered payloads get 401.
 * - Replays: keyed on the SHA-256 of the raw body and marked only AFTER the
 *   subscription row was written (or the event was deliberately skipped), so
 *   a failed write answers 5xx and Lemon's retry is applied, not deduped.
 *   Distinct deliveries (e.g. two `subscription_updated` for one sub) have
 *   different bodies and are never collapsed.
 * - Test mode: `meta.test_mode === true` is acknowledged without writes
 *   unless `ALLOW_TEST_MODE` is "true".
 * - Ordering: Lemon's `attributes.updated_at` is stored in
 *   `subscriptions.lemon_updated_at` (migration 0012); strictly older events
 *   are acknowledged and skipped. Without the column the ordering check is
 *   off and writes proceed as before.
 */

import type { FetchImpl } from './account';
import { classifySubscriptionEvent } from './billing';
import {
  MAX_WEBHOOK_BODY_BYTES,
  buildSecurityHeaders,
  createReplayGuard,
  declaredBodyTooLarge,
  mergeHeaders,
  type ReplayGuard,
} from './security';
import {
  accessPeriodEnd,
  normalizeStatus,
  resolvePlanId,
  type LemonSubscriptionAttributes,
} from './subscriptionAccess';

export interface LemonWebhookEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
  LEMON_YEARLY_IDS?: string;
  LEMON_MONTHLY_IDS?: string;
  /** "true" lets `meta.test_mode` events grant Pro (staging / checkout tests). */
  ALLOW_TEST_MODE?: string;
}

/** Same body applies once per hour per isolate (best-effort, see security.ts). */
const defaultReplayGuard = createReplayGuard(3_600_000);

/** PostgREST codes for "column does not exist" (migration 0012 not applied). */
const MISSING_COLUMN_CODES: ReadonlySet<string> = new Set(['42703', 'PGRST204']);

function api(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), { 'Content-Type': 'application/json' }),
  });
}

function restHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

export async function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = new Uint8Array(
      signatureHeader.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(rawBody));
  } catch {
    return false;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lemon ISO timestamp → normalized ISO, or null when absent/unparseable. */
export function lemonUpdatedAt(attrs: LemonSubscriptionAttributes): string | null {
  const raw = attrs.updated_at;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

async function errorCode(res: Response): Promise<string> {
  try {
    return String(((await res.json()) as { code?: unknown }).code ?? '');
  } catch {
    return '';
  }
}

type StoredOrder = { kind: 'ok'; value: string | null } | { kind: 'no-column' } | { kind: 'error' };

async function readStoredOrder(
  env: Required<Pick<LemonWebhookEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>>,
  userId: string,
  fetchImpl: FetchImpl,
): Promise<StoredOrder> {
  try {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=lemon_updated_at&limit=1`,
      { headers: restHeaders(env.SUPABASE_SERVICE_ROLE_KEY) },
    );
    if (!res.ok) {
      return MISSING_COLUMN_CODES.has(await errorCode(res))
        ? { kind: 'no-column' }
        : { kind: 'error' };
    }
    const rows = (await res.json()) as Array<{ lemon_updated_at?: string | null }>;
    return { kind: 'ok', value: rows[0]?.lemon_updated_at ?? null };
  } catch {
    return { kind: 'error' };
  }
}

export async function handleLemonSqueezyWebhook(
  request: Request,
  env: LemonWebhookEnv,
  fetchImpl: FetchImpl = fetch,
  replayGuard: ReplayGuard = defaultReplayGuard,
): Promise<Response> {
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    return api({ error: 'Webhook not configured' }, 503);
  }

  // Cheap pre-read size gate (chunked/lying senders are re-checked below).
  if (declaredBodyTooLarge(request, MAX_WEBHOOK_BODY_BYTES)) {
    return api({ error: 'Payload too large' }, 413);
  }
  const rawBody = await request.text();
  if (rawBody.length > MAX_WEBHOOK_BODY_BYTES) {
    return api({ error: 'Payload too large' }, 413);
  }

  const isValid = await verifyLemonSqueezySignature(
    rawBody,
    request.headers.get('x-signature'),
    env.LEMON_SQUEEZY_WEBHOOK_SECRET,
  );
  if (!isValid) return api({ error: 'Invalid signature' }, 401);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return api({ error: 'Invalid JSON' }, 400);
  }

  // Only subscription-lifecycle events may write. Malformed payloads are
  // rejected (not retryable); anything else is acknowledged without effects.
  const classified = classifySubscriptionEvent(payload);
  if (classified.action === 'reject') {
    return api({ error: classified.reason ?? 'Invalid payload' }, 400);
  }
  const eventName = payload?.meta?.event_name;
  if (classified.action === 'ignore') {
    return api({ ok: true, ignored: eventName }, 200);
  }

  if (payload?.meta?.test_mode === true && env.ALLOW_TEST_MODE !== 'true') {
    return api({ ok: true, ignored: 'test_mode' }, 200);
  }

  const replayKey = await sha256Hex(rawBody);
  if (replayGuard.seen(replayKey)) {
    return api({ ok: true, deduped: true }, 200);
  }

  const userId = payload?.meta?.custom_data?.user_id;
  if (!userId) {
    replayGuard.mark(replayKey);
    return api({ ok: true, message: 'No custom user_id in payload, skipping' }, 200);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // 500 so the sender retries once the service role is provisioned.
    return api({ error: 'Database not configured' }, 500);
  }
  const db = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const data = payload?.data;
  const attrs: LemonSubscriptionAttributes = data?.attributes || {};
  const eventUpdatedAt = lemonUpdatedAt(attrs);

  const stored = await readStoredOrder(db, String(userId), fetchImpl);
  if (stored.kind === 'error') {
    return api({ error: 'Database error' }, 500);
  }
  if (
    stored.kind === 'ok' &&
    stored.value &&
    eventUpdatedAt &&
    Date.parse(eventUpdatedAt) < Date.parse(stored.value)
  ) {
    replayGuard.mark(replayKey);
    return api({ ok: true, skipped: 'stale' }, 200);
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    lemon_customer_id: String(attrs.customer_id || ''),
    lemon_subscription_id: String(data?.id || ''),
    status: normalizeStatus(attrs.status),
    plan_id: resolvePlanId(attrs, {
      yearlyIds: env.LEMON_YEARLY_IDS,
      monthlyIds: env.LEMON_MONTHLY_IDS,
    }),
    current_period_end: accessPeriodEnd(attrs),
    updated_at: new Date().toISOString(),
  };
  if (stored.kind === 'ok' && eventUpdatedAt) row.lemon_updated_at = eventUpdatedAt;

  const upsert = (body: Record<string, unknown>) =>
    fetchImpl(`${db.SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: {
        ...restHeaders(db.SUPABASE_SERVICE_ROLE_KEY),
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(body),
    });

  try {
    let response = await upsert(row);
    if (!response.ok && 'lemon_updated_at' in row && response.status !== 409) {
      if (MISSING_COLUMN_CODES.has(await errorCode(response))) {
        const legacyRow = { ...row };
        delete legacyRow.lemon_updated_at;
        response = await upsert(legacyRow);
      }
    }

    if (response.status === 409) {
      // FK miss: the account is gone (e.g. the cancellation its deletion
      // triggered). Acknowledge so Lemon stops retrying.
      replayGuard.mark(replayKey);
      return api({ ok: true, skipped: 'unknown user' }, 200);
    }
    if (!response.ok) {
      // Never echo upstream bodies; 5xx so Lemon retries.
      return api({ error: 'Upstream update failed' }, 500);
    }
  } catch {
    return api({ error: 'Database error' }, 500);
  }

  replayGuard.mark(replayKey);
  return api({ ok: true, event: eventName, user_id: userId }, 200);
}
