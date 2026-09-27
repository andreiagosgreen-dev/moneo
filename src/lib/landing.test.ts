import { describe, expect, it } from 'vitest';
import {
  LANDING_PATH,
  isFirstVisit,
  isFirstVisitLanding,
  landingView,
  readStorageKeys,
} from './landing';
import { STORAGE_KEYS } from './storage/storageKeys';

const fresh = (pathname: string, search = '') => landingView({ pathname, search, storageKeys: [] });

describe('landingView', () => {
  it('shows the landing on / for a brand-new browser', () => {
    expect(fresh('/')).toBe('landing');
  });

  it('always shows the landing on /welcome, even for existing users', () => {
    expect(fresh(LANDING_PATH)).toBe('landing');
    expect(fresh(`${LANDING_PATH}/`)).toBe('landing');
    expect(
      landingView({
        pathname: LANDING_PATH,
        search: '',
        storageKeys: [STORAGE_KEYS.history, 'sb-abc-auth-token'],
      }),
    ).toBe('landing');
  });

  it('never intercepts deep links', () => {
    for (const path of [
      '/pricing',
      '/account',
      '/login',
      '/reset-password',
      '/terms',
      '/privacy',
      '/refund',
      '/help',
      '/account/calendar-callback',
    ]) {
      expect(fresh(path)).toBe('app');
    }
    expect(fresh('/account', '?billing=success')).toBe('app');
  });

  it('keeps app deep links on / (PWA shortcut) in the app', () => {
    expect(fresh('/', '?action=focus')).toBe('app');
    expect(fresh('/', '?utm_source=x&action=focus')).toBe('app');
  });

  it('ignores marketing params on a shared / link', () => {
    expect(fresh('/', '?utm_source=tiktok&utm_campaign=bac')).toBe('landing');
    expect(fresh('/', '?ref=friend')).toBe('landing');
    expect(fresh('/', '?fbclid=abc')).toBe('landing');
  });

  it('sends anyone with local data, a session or a click on "Start free" to the app', () => {
    const cases: string[][] = [
      [STORAGE_KEYS.history],
      [STORAGE_KEYS.projects],
      [STORAGE_KEYS.onboardingSeen],
      [STORAGE_KEYS.atmosphere],
      ['moneo.coach.dismissed.aziEmpty'],
      ['sb-yvkguiiqojwyosvkxzbt-auth-token'],
      [STORAGE_KEYS.landingSeen],
    ];
    for (const storageKeys of cases) {
      expect(landingView({ pathname: '/', search: '', storageKeys }), storageKeys[0]).toBe('app');
    }
  });
});

describe('landingView — detour from the landing (e.g. to /pricing and back)', () => {
  const appWrote = [STORAGE_KEYS.theme, STORAGE_KEYS.focusAreas];

  it('keeps a first-time visitor on the landing in the same tab', () => {
    expect(
      landingView({ pathname: '/', search: '', storageKeys: appWrote, activeInTab: true }),
    ).toBe('landing');
  });

  it('goes to the app once they pressed "Start free" or signed in', () => {
    for (const extra of [STORAGE_KEYS.landingSeen, 'sb-ref-auth-token']) {
      expect(
        landingView({
          pathname: '/',
          search: '',
          storageKeys: [...appWrote, extra],
          activeInTab: true,
        }),
      ).toBe('app');
    }
  });

  it('never applies outside / and never without the tab flag', () => {
    expect(
      landingView({ pathname: '/pricing', search: '', storageKeys: [], activeInTab: true }),
    ).toBe('app');
    expect(landingView({ pathname: '/', search: '', storageKeys: appWrote })).toBe('app');
  });
});

describe('isFirstVisitLanding', () => {
  it('is true only for / in a new browser, not for /welcome', () => {
    expect(isFirstVisitLanding({ pathname: '/', search: '', storageKeys: [] })).toBe(true);
    expect(isFirstVisitLanding({ pathname: LANDING_PATH, search: '', storageKeys: [] })).toBe(
      false,
    );
    expect(
      isFirstVisitLanding({ pathname: '/', search: '', storageKeys: [STORAGE_KEYS.history] }),
    ).toBe(false);
  });
});

describe('isFirstVisit', () => {
  it('ignores the language choice and keys from other apps', () => {
    expect(isFirstVisit([STORAGE_KEYS.locale, 'other-app', 'theme'])).toBe(true);
  });
});

describe('readStorageKeys', () => {
  it('lists keys and never throws', () => {
    const map = new Map([
      ['a', '1'],
      ['b', '2'],
    ]);
    const storage = {
      get length() {
        return map.size;
      },
      key: (i: number) => [...map.keys()][i] ?? null,
    } as unknown as Storage;
    expect(readStorageKeys(storage)).toEqual(['a', 'b']);

    const broken = {
      get length(): number {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(readStorageKeys(broken)).toEqual([]);
  });
});
