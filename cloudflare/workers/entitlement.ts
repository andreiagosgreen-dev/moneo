/**
 * `GET /api/account/entitlement` — does the signed-in account have
 * complimentary (gifted) Pro?
 *
 * The allowlist lives only here on the Worker (hardcoded + the
 * PRO_COMPLIMENTARY_EMAILS var), so no email address ships in the public
 * client bundle. The browser learns a single boolean about itself.
 */

import { bearerToken, verifyUser, type FetchImpl } from './account';
import { hasComplimentaryPro, resolveComplimentaryAllowlist } from './complimentaryPro';
import { buildSecurityHeaders, mergeHeaders } from './security';

export interface EntitlementEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PRO_COMPLIMENTARY_EMAILS?: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(buildSecurityHeaders(), {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }),
  });
}

export async function handleEntitlement(
  request: Request,
  env: EntitlementEnv,
  fetchImpl: FetchImpl = fetch,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Not configured' }, 503);
  }
  const token = bearerToken(request);
  if (!token) return json({ error: 'Missing or invalid authorization' }, 401);
  const user = await verifyUser(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token, fetchImpl);
  if (!user) return json({ error: 'Invalid or expired session' }, 401);
  const complimentary = hasComplimentaryPro(
    user.email,
    resolveComplimentaryAllowlist(env.PRO_COMPLIMENTARY_EMAILS),
  );
  return json({ complimentary }, 200);
}
