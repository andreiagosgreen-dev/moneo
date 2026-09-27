import { describe, expect, it } from 'vitest';

import { DEFAULT_TITLE, titleForPath } from './routeTitle';

describe('titleForPath', () => {
  it('names the public pages', () => {
    expect(titleForPath('/pricing')).toBe('Pricing — Moneo');
    expect(titleForPath('/help')).toBe('Help — Moneo');
    expect(titleForPath('/privacy')).toBe('Privacy Policy — Moneo');
    expect(titleForPath('/terms')).toBe('Terms of Service — Moneo');
    expect(titleForPath('/refund')).toBe('Refund Policy — Moneo');
    expect(titleForPath('/pricing/')).toBe('Pricing — Moneo');
  });

  it('falls back to the app title', () => {
    expect(titleForPath('/')).toBe(DEFAULT_TITLE);
    expect(titleForPath('/anything-else')).toBe(DEFAULT_TITLE);
  });
});
