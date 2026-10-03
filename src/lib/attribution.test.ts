import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ATTRIBUTION_TTL_MS,
  captureAttribution,
  cleanTag,
  currentSource,
  mergeAttribution,
  readAttribution,
  sourceFromReferrer,
} from './attribution';
import { buildCheckoutUrl } from './billing/lemonSqueezy';
import { countBillingEvent } from '../../cloudflare/workers/lemonWebhook';

const NOW = Date.parse('2026-10-03T10:00:00Z');
const HOST = 'moneo.bond';

describe('labels', () => {
  it('keeps short, safe, lowercase labels', () => {
    expect(cleanTag(' TikTok ')).toBe('tiktok');
    expect(cleanTag('Exam Week 2026')).toBe('exam-week-2026');
    expect(cleanTag('<b>x</b>')).toBe('bxb');
    expect(cleanTag('-x')).toBe('');
    expect(cleanTag('a'.repeat(50))).toHaveLength(32);
    expect(cleanTag(42)).toBe('');
  });

  it('names known referrers and ignores our own site', () => {
    expect(sourceFromReferrer('https://www.google.com/search?q=x', HOST)).toBe('google');
    expect(sourceFromReferrer('https://l.instagram.com/?u=x', HOST)).toBe('instagram');
    expect(sourceFromReferrer('https://t.co/abc', HOST)).toBe('x');
    expect(sourceFromReferrer('https://some-blog.example/post', HOST)).toBe('other');
    expect(sourceFromReferrer('https://moneo.bond/pricing', HOST)).toBe('');
    expect(sourceFromReferrer('', HOST)).toBe('');
  });
});

describe('readAttribution / mergeAttribution', () => {
  it('prefers utm_source (or ref), then the referrer', () => {
    expect(readAttribution('?utm_source=TikTok&utm_campaign=exam', '', HOST, NOW)).toEqual({
      source: 'tiktok',
      campaign: 'exam',
      at: NOW,
    });
    expect(readAttribution('?ref=andrei', 'https://www.google.com/', HOST, NOW)?.source).toBe(
      'andrei',
    );
    expect(readAttribution('', 'https://www.reddit.com/r/x', HOST, NOW)?.source).toBe('reddit');
    expect(readAttribution('', '', HOST, NOW)).toBeNull();
  });

  it('a tagged visit replaces, a plain referrer only fills an empty or expired slot', () => {
    const tiktok = { source: 'tiktok', campaign: '', at: NOW - 86_400_000 };
    const google = { source: 'google', campaign: '', at: NOW };
    const reddit = { source: 'reddit', campaign: 'launch', at: NOW };
    expect(mergeAttribution(tiktok, google, NOW, false)).toBe(tiktok);
    expect(mergeAttribution(tiktok, reddit, NOW, true)).toBe(reddit);
    const expired = { ...tiktok, at: NOW - ATTRIBUTION_TTL_MS - 1 };
    expect(mergeAttribution(expired, google, NOW, false)).toBe(google);
    expect(mergeAttribution(expired, null, NOW, false)).toBeNull();
  });
});

describe('capture in the browser', () => {
  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.unstubAllGlobals();
  });

  it('remembers a campaign for later counters and checkout', () => {
    window.history.replaceState(null, '', '/ro?utm_source=TikTok&utm_campaign=sesiune');
    captureAttribution(NOW);
    window.history.replaceState(null, '', '/');
    captureAttribution(NOW + 1000);
    expect(currentSource(NOW + 2000)).toEqual({ source: 'tiktok', campaign: 'sesiune' });
    expect(currentSource(NOW + ATTRIBUTION_TTL_MS + 1)).toEqual({ source: 'direct', campaign: '' });
  });

  it('stores nothing and reports nothing under Do Not Track', () => {
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    window.history.replaceState(null, '', '/?utm_source=tiktok');
    captureAttribution(NOW);
    expect(localStorage.getItem('moneo:attribution')).toBeNull();
    expect(currentSource(NOW)).toEqual({ source: '', campaign: '' });
  });
});

describe('checkout carries the channel', () => {
  it('adds clean src/cmp custom fields only when there is a channel', () => {
    vi.stubEnv('VITE_LEMONSQUEEZY_CHECKOUT_URL', 'https://moneo.lemonsqueezy.com/checkout');
    vi.stubEnv('VITE_LEMONSQUEEZY_STORE_ID', '1');
    vi.stubEnv('VITE_LEMONSQUEEZY_MONTHLY_VARIANT_ID', 'v-month');
    const tagged = buildCheckoutUrl('pro-monthly', 'u1', undefined, null, {
      source: 'TikTok',
      campaign: 'Exam Week',
    });
    expect(tagged).toContain('&checkout[custom][src]=tiktok&checkout[custom][cmp]=exam-week');
    const plain = buildCheckoutUrl('pro-monthly', 'u1', undefined, null, {
      source: '',
      campaign: '',
    });
    expect(plain).not.toContain('[src]');
    vi.unstubAllEnvs();
  });
});

describe('billing webhook counts by channel', () => {
  const env = () => ({ EVENTS: { writeDataPoint: vi.fn() } });
  const blobsOf = (e: ReturnType<typeof env>) =>
    e.EVENTS.writeDataPoint.mock.calls.map((c) => (c[0] as { blobs: string[] }).blobs);

  it('counts a trial start, a direct paid start and a real payment', () => {
    const e = env();
    countBillingEvent(e, {
      meta: { event_name: 'subscription_created', custom_data: { user_id: 'u', src: 'tiktok' } },
      data: { attributes: { status: 'on_trial', product_name: 'Moneo Pro (Monthly)' } },
    });
    countBillingEvent(e, {
      meta: { event_name: 'subscription_created', custom_data: { user_id: 'u' } },
      data: { attributes: { status: 'active', product_name: 'Moneo Pro (Yearly)' } },
    });
    countBillingEvent(e, {
      meta: {
        event_name: 'subscription_payment_success',
        custom_data: { src: 'reddit', cmp: 'launch' },
      },
      data: { attributes: { total_usd: 599 } },
    });
    expect(blobsOf(e)).toEqual([
      ['subscribe', 'pro-monthly', '', 'tiktok', '', 'trial'],
      ['subscribe', 'pro-yearly', '', 'direct', '', 'paid'],
      ['payment', '', '', 'reddit', 'launch', 'paid'],
    ]);
    expect(e.EVENTS.writeDataPoint.mock.calls[2][0]).toMatchObject({ doubles: [1, 5.99] });
  });

  it('ignores test mode, $0 trial invoices and other events', () => {
    const e = env();
    countBillingEvent(e, {
      meta: { event_name: 'subscription_created', test_mode: true },
      data: { attributes: { status: 'active' } },
    });
    countBillingEvent(e, {
      meta: { event_name: 'subscription_payment_success' },
      data: { attributes: { total_usd: 0 } },
    });
    countBillingEvent(e, {
      meta: { event_name: 'subscription_updated' },
      data: { attributes: {} },
    });
    expect(e.EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });
});
