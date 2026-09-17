/**
 * Lemon Squeezy webhook classification (Roadmap Faza 0.3).
 *
 * Only subscription-lifecycle events may mutate the subscriptions table.
 * Payment notifications (success/failed/recovered) carry no plan change and
 * are acknowledged without side effects, so retries and unrelated event
 * types can never corrupt billing state. Processing itself is idempotent:
 * the handler upserts on the user_id primary key.
 */

export type SubscriptionEventAction = 'process' | 'ignore' | 'reject';

const SUBSCRIPTION_LIFECYCLE_EVENTS: ReadonlySet<string> = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_resumed',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
]);

export interface ClassifiedEvent {
  action: SubscriptionEventAction;
  reason?: string;
}

/**
 * Validate schema and decide what to do with a webhook payload.
 * - reject: malformed (caller should answer 400 — not retryable).
 * - ignore: well-formed but not a lifecycle event (answer 200, no writes).
 * - process: lifecycle event with a subscription id (upsert downstream).
 */
export function classifySubscriptionEvent(payload: unknown): ClassifiedEvent {
  if (!payload || typeof payload !== 'object') {
    return { action: 'reject', reason: 'Invalid payload' };
  }
  const record = payload as { meta?: unknown; data?: unknown };
  const eventName =
    record.meta && typeof record.meta === 'object'
      ? (record.meta as { event_name?: unknown }).event_name
      : undefined;
  if (typeof eventName !== 'string' || eventName.length === 0) {
    return { action: 'reject', reason: 'Missing event_name' };
  }
  const data = record.data;
  const subscriptionId =
    data && typeof data === 'object' ? (data as { id?: unknown }).id : undefined;
  if (typeof subscriptionId !== 'string' || subscriptionId.length === 0) {
    return { action: 'reject', reason: 'Missing data.id' };
  }
  if (!SUBSCRIPTION_LIFECYCLE_EVENTS.has(eventName)) {
    return { action: 'ignore', reason: `Non-lifecycle event: ${eventName}` };
  }
  return { action: 'process' };
}
