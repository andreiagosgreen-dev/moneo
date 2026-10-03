import { describe, expect, it, vi } from 'vitest';
import { optedOut, track } from './analytics';
import { cleanEvent, handleEvent, writeEvent } from '../../cloudflare/workers/events';

describe('track (client)', () => {
  it('sends only the event, plan, 2-letter language and channel label', async () => {
    const sendBeacon = vi.fn(() => true);
    expect(
      track(
        'checkout_open',
        'pro-yearly',
        'ro-RO',
        { sendBeacon },
        { source: 'tiktok', campaign: 'exam' },
      ),
    ).toBe(true);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe('/api/event');
    expect(JSON.parse(await blob.text())).toEqual({
      e: 'checkout_open',
      p: 'pro-yearly',
      l: 'ro',
      s: 'tiktok',
      c: 'exam',
    });
  });

  it('leaves the channel out when there is none', async () => {
    const sendBeacon = vi.fn(() => true);
    track('landing_view', undefined, 'en', { sendBeacon }, { source: '', campaign: '' });
    const [, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(JSON.parse(await blob.text())).toEqual({ e: 'landing_view', l: 'en' });
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
  it('keeps only allowlisted values and clean channel labels', () => {
    expect(
      cleanEvent({ e: 'checkout_open', p: 'pro-monthly', l: 'de', s: 'TikTok', c: 'Exam Week' }),
    ).toEqual({
      name: 'checkout_open',
      plan: 'pro-monthly',
      lang: 'de',
      source: 'tiktok',
      campaign: 'exam-week',
    });
    expect(cleanEvent({ e: 'checkout_open', p: 'x@y.com', l: 'zz', s: '<script>' })).toEqual({
      name: 'checkout_open',
      plan: '',
      lang: '',
      source: 'script',
      campaign: '',
    });
    expect(cleanEvent({ e: 'landing_view' })?.name).toBe('landing_view');
    expect(cleanEvent({ e: 'user:42' })).toBeNull();
    // Server-only names can't be sent by a client.
    expect(cleanEvent({ e: 'subscribe' })).toBeNull();
  });

  it('writes one anonymous point and always answers 204', async () => {
    const writeDataPoint = vi.fn();
    const post = (body: string) =>
      new Request('https://moneo.bond/api/event', { method: 'POST', body });
    const ok = await handleEvent(post('{"e":"onboarding_done","l":"ro","s":"reddit"}'), {
      EVENTS: { writeDataPoint },
    });
    expect(ok.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['onboarding_done'],
      blobs: ['onboarding_done', '', 'ro', 'reddit', '', ''],
      doubles: [1, 0],
    });
    expect((await handleEvent(post('not json'), { EVENTS: { writeDataPoint } })).status).toBe(204);
    expect((await handleEvent(post('{"e":"onboarding_done"}'), {})).status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it('labels an unknown channel as direct and records revenue for payments', () => {
    const writeDataPoint = vi.fn();
    writeEvent(
      { EVENTS: { writeDataPoint } },
      { name: 'payment', status: 'paid', revenueUsd: 5.99 },
    );
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['payment'],
      blobs: ['payment', '', '', 'direct', '', 'paid'],
      doubles: [1, 5.99],
    });
  });
});
