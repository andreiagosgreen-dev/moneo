import { describe, expect, it } from 'vitest';
import { isStaticAssetPath } from '../../../cloudflare/workers/staticAssetPath';

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
    expect(isStaticAssetPath('/account')).toBe(false);
    expect(isStaticAssetPath('/account/calendar-callback')).toBe(false);
    expect(isStaticAssetPath('/index.html')).toBe(false);
  });
});
