import { describe, expect, it } from 'vitest';

import { createI18n } from './i18n';
import { ro } from './i18n/locales/ro';
import { titleForPath } from './routeTitle';

const { t } = createI18n('en');

describe('titleForPath', () => {
  it('names the public pages', () => {
    expect(titleForPath('/pricing', t)).toBe('Pricing — Moneo');
    expect(titleForPath('/help', t)).toBe('Help — Moneo');
    expect(titleForPath('/privacy', t)).toBe('Privacy Policy — Moneo');
    expect(titleForPath('/terms', t)).toBe('Terms of Service — Moneo');
    expect(titleForPath('/refund', t)).toBe('Refund Policy — Moneo');
    expect(titleForPath('/pricing/', t)).toBe('Pricing — Moneo');
  });

  it('falls back to the app title', () => {
    expect(titleForPath('/', t)).toBe('Moneo — Focus Timer');
    expect(titleForPath('/anything-else', t)).toBe('Moneo — Focus Timer');
  });

  it('localizes titles', () => {
    const roT = createI18n('ro', ro).t;
    expect(titleForPath('/pricing', roT)).toBe('Prețuri — Moneo');
    expect(titleForPath('/login', roT)).toBe('Autentificare — Moneo');
    expect(titleForPath('/', roT)).toBe('Moneo — Cronometru de focus');
  });
});
