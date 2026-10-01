import { describe, expect, it } from 'vitest';
import {
  KNOWN_CLIENT_ROUTE_LIST,
  getCacheControl,
  getContentType,
  isKnownClientRoute,
  isStaticAssetPath,
  isRevalidateAlwaysPath,
  withRouteCanonical,
} from '../../../cloudflare/workers/staticAssetPath';
import { LEGAL_PATHS } from '../legal/seller';
import { LANDING_LANGS, LANDING_PATH } from '../landing';
import appSource from '../../App.tsx?raw';

describe('isStaticAssetPath', () => {
  it('treats hashed build assets as static (no SPA HTML fallback)', () => {
    expect(isStaticAssetPath('/assets/index-BED1igKF.js')).toBe(true);
    expect(isStaticAssetPath('/assets/index-BbFM633-.css')).toBe(true);
    expect(isStaticAssetPath('/assets/inter-latin-400-normal-CyCys3Eg.woff2')).toBe(true);
    expect(isStaticAssetPath('/sw.js')).toBe(true);
    expect(isStaticAssetPath('/manifest.webmanifest')).toBe(true);
    expect(isStaticAssetPath('/icon-192.png')).toBe(true);
  });

  it('allows SPA fallback for client routes without a file extension', () => {
    expect(isStaticAssetPath('/privacy')).toBe(false);
    expect(isStaticAssetPath('/terms')).toBe(false);
    expect(isStaticAssetPath('/refund')).toBe(false);
    expect(isStaticAssetPath('/welcome')).toBe(false);
    expect(isStaticAssetPath('/account')).toBe(false);
    expect(isStaticAssetPath('/account/calendar-callback')).toBe(false);
    expect(isStaticAssetPath('/index.html')).toBe(false);
  });
});

describe('isRevalidateAlwaysPath', () => {
  it('marks shell, SW, and manifest for short cache', () => {
    expect(isRevalidateAlwaysPath('/index.html')).toBe(true);
    expect(isRevalidateAlwaysPath('/sw.js')).toBe(true);
    expect(isRevalidateAlwaysPath('/manifest.webmanifest')).toBe(true);
  });

  it('leaves hashed assets on immutable long-cache', () => {
    expect(isRevalidateAlwaysPath('/assets/index-BED1igKF.js')).toBe(false);
    expect(isRevalidateAlwaysPath('/icon-192.png')).toBe(false);
  });
});

describe('getContentType', () => {
  it('serves SEO files as text, not octet-stream', () => {
    expect(getContentType('/sitemap.xml')).toBe('application/xml; charset=utf-8');
    expect(getContentType('/robots.txt')).toBe('text/plain; charset=utf-8');
  });

  it('keeps web app manifest and build asset types', () => {
    expect(getContentType('/manifest.webmanifest')).toBe('application/manifest+json');
    expect(getContentType('/assets/index-BED1igKF.js')).toBe('application/javascript');
    expect(getContentType('/index.html')).toBe('text/html');
    expect(getContentType('/favicon.ico')).toBe('image/x-icon');
    expect(getContentType('/no-extension')).toBe('application/octet-stream');
  });
});

describe('getCacheControl', () => {
  it('caches sitemap and robots for one hour, not immutable', () => {
    expect(getCacheControl('/sitemap.xml')).toBe('public, max-age=3600');
    expect(getCacheControl('/robots.txt')).toBe('public, max-age=3600');
  });

  it('revalidates the shell and keeps hashed assets immutable', () => {
    expect(getCacheControl('/index.html')).toBe('public, max-age=0, must-revalidate');
    expect(getCacheControl('/manifest.webmanifest')).toBe('public, max-age=0, must-revalidate');
    expect(getCacheControl('/assets/index-BED1igKF.js')).toBe(
      'public, max-age=31536000, immutable',
    );
  });
});

describe('isKnownClientRoute', () => {
  it('accepts router paths, tolerating trailing slash and case', () => {
    expect(isKnownClientRoute('/')).toBe(true);
    expect(isKnownClientRoute('/welcome')).toBe(true);
    expect(isKnownClientRoute('/pricing/')).toBe(true);
    expect(isKnownClientRoute('/Account')).toBe(true);
    expect(isKnownClientRoute('/account/calendar-callback')).toBe(true);
    expect(isKnownClientRoute('/reset-password')).toBe(true);
  });

  it('rejects unknown paths so the shell is served as 404', () => {
    expect(isKnownClientRoute('/nope')).toBe(false);
    expect(isKnownClientRoute('/wp-admin')).toBe(false);
    expect(isKnownClientRoute('/account/other')).toBe(false);
    expect(isKnownClientRoute('/pricing/extra')).toBe(false);
  });

  it('covers every route declared in the app router', () => {
    const declared = [...appSource.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    const expected = new Set([
      '/',
      LANDING_PATH,
      ...LANDING_LANGS.map((l) => `/${l}`),
      ...Object.values(LEGAL_PATHS),
      ...declared,
    ]);
    expect(new Set(KNOWN_CLIENT_ROUTE_LIST)).toEqual(expected);
  });
});

describe('withRouteCanonical', () => {
  const shell =
    '<head><link rel="canonical" href="https://moneo.bond/" /><title>Moneo</title></head>';

  it('points the shell canonical at the route itself', () => {
    expect(withRouteCanonical(shell, '/pricing')).toContain(
      '<link rel="canonical" href="https://moneo.bond/pricing" />',
    );
    expect(withRouteCanonical(shell, '/terms')).not.toContain('href="https://moneo.bond/"');
  });

  it('normalizes case and a trailing slash like the router', () => {
    expect(withRouteCanonical(shell, '/Privacy/')).toContain('href="https://moneo.bond/privacy"');
  });

  it('leaves the home page canonical alone', () => {
    expect(withRouteCanonical(shell, '/')).toBe(shell);
  });

  it('is a no-op when the shell has no root canonical', () => {
    const bare = '<head><title>Moneo</title></head>';
    expect(withRouteCanonical(bare, '/help')).toBe(bare);
  });
});
