import { describe, expect, it } from 'vitest';

import { classifySubscriptionEvent } from '../../cloudflare/workers/billing';

function payload(eventName: unknown, id: unknown = 'sub-1') {
  return { meta: { event_name: eventName }, data: { id, attributes: {} } };
}

describe('classifySubscriptionEvent', () => {
  it.each([
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_resumed',
    'subscription_expired',
    'subscription_paused',
    'subscription_unpaused',
  ])('processes lifecycle event %s', (eventName) => {
    expect(classifySubscriptionEvent(payload(eventName))).toEqual({ action: 'process' });
  });

  it.each([
    'subscription_payment_success',
    'subscription_payment_failed',
    'subscription_payment_recovered',
    'order_created',
    'license_created',
  ])('ignores non-lifecycle event %s without writes', (eventName) => {
    const result = classifySubscriptionEvent(payload(eventName));
    expect(result.action).toBe('ignore');
    expect(result.reason).toContain(String(eventName));
  });

  it('rejects malformed payloads (not retryable)', () => {
    expect(classifySubscriptionEvent(null).action).toBe('reject');
    expect(classifySubscriptionEvent('nope').action).toBe('reject');
    expect(classifySubscriptionEvent({}).action).toBe('reject');
    expect(classifySubscriptionEvent(payload(undefined)).action).toBe('reject');
    expect(
      classifySubscriptionEvent({
        meta: { event_name: 'subscription_created' },
        data: { id: null },
      }).action,
    ).toBe('reject');
    expect(
      classifySubscriptionEvent({
        meta: { event_name: 'subscription_created' },
        data: {},
      }).action,
    ).toBe('reject');
    expect(classifySubscriptionEvent(payload('subscription_created', 42)).action).toBe('reject');
  });
});
