import { describe, expect, it } from 'vitest';
import { isLandingPath, landingLangFromPath, landingView } from '../lib/landing';
import { isKnownClientRoute } from '../lib/knownRoutes';
import { landingPathFor, prerenderLanding, PRERENDER_LOCALES } from './prerender';

describe('language landing routes', () => {
  it('maps /ro, /de … to their language and keeps /welcome English', () => {
    expect(landingLangFromPath('/ro')).toBe('ro');
    expect(landingLangFromPath('/DE/')).toBe('de');
    expect(landingLangFromPath('/welcome')).toBeNull();
    expect(landingLangFromPath('/pricing')).toBeNull();
    expect(isLandingPath('/welcome')).toBe(true);
    expect(isLandingPath('/it')).toBe(true);
    expect(isLandingPath('/help')).toBe(false);
  });

  it('always shows the landing on a language path, even to returning visitors', () => {
    expect(landingView({ pathname: '/ro', search: '', storageKeys: ['moneo:landing-seen'] })).toBe(
      'landing',
    );
  });

  it('every landing path is a known route (no 404 from the Worker)', () => {
    for (const l of PRERENDER_LOCALES) expect(isKnownClientRoute(landingPathFor(l))).toBe(true);
  });
});

describe('prerendered landing', () => {
  it('renders real content with localized head tags and valid structured data', async () => {
    const page = await prerenderLanding('ro');
    expect(page.path).toBe('/ro');
    expect(page.body.length).toBeGreaterThan(5000);
    expect(page.head).toContain('<link rel="canonical" href="https://moneo.bond/ro" />');
    expect(page.head).toContain('hreflang="x-default" href="https://moneo.bond/welcome"');
    for (const l of PRERENDER_LOCALES) expect(page.head).toContain(`hreflang="${l}"`);
    const blocks = [...page.head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    const types = blocks.map((m) => JSON.parse(m[1])['@type']);
    expect(types).toEqual(['SoftwareApplication', 'FAQPage']);
    const app = JSON.parse(blocks[0][1]);
    expect(app.offers.map((o: { price: string }) => o.price)).toEqual(['0', '5.99', '59.99']);
  });
});
