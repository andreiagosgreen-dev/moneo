import { describe, expect, it, vi } from 'vitest';
import { optedOut, track } from './analytics';
import { cleanEvent, handleEvent } from '../../cloudflare/workers/events';

describe('track (client)', () => {
  it('sends only the event, plan and 2-letter language', async () => {
    const sendBeacon = vi.fn(() => true);
    expect(track('checkout_open', 'pro-yearly', 'ro-RO', { sendBeacon })).toBe(true);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe('/api/event');
    expect(JSON.parse(await blob.text())).toEqual({ e: 'checkout_open', p: 'pro-yearly', l: 'ro' });
  });

  it('respects Do Not Track and Global Privacy Control', () => {
    const sendBeacon = vi.fn(() => true);
    expect(track('pricing_view', undefined, 'en', { sendBeacon, doNotTrack: '1' })).toBe(false);
    expect(track('pricing_view', undefined, 'en', { sendBeacon, globalPrivacyControl: true })).toBe(
      false,
    );
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(optedOut(undefined)).toBe(true);
  });
});

describe('POST /api/event (Worker)', () => {
  it('keeps only allowlisted values', () => {
    expect(cleanEvent({ e: 'checkout_open', p: 'pro-monthly', l: 'de' })).toEqual({
      name: 'checkout_open',
      plan: 'pro-monthly',
      lang: 'de',
    });
    expect(cleanEvent({ e: 'checkout_open', p: 'x@y.com', l: 'zz' })).toEqual({
      name: 'checkout_open',
      plan: '',
      lang: '',
    });
    expect(cleanEvent({ e: 'user:42' })).toBeNull();
  });

  it('writes one anonymous point and always answers 204', async () => {
    const writeDataPoint = vi.fn();
    const post = (body: string) =>
      new Request('https://moneo.bond/api/event', { method: 'POST', body });
    const ok = await handleEvent(post('{"e":"onboarding_done","l":"ro"}'), {
      EVENTS: { writeDataPoint },
    });
    expect(ok.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['onboarding_done'],
      blobs: ['onboarding_done', '', 'ro'],
      doubles: [1],
    });
    expect((await handleEvent(post('not json'), { EVENTS: { writeDataPoint } })).status).toBe(204);
    expect((await handleEvent(post('{"e":"onboarding_done"}'), {})).status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });
});
