import type { TKey } from './i18n/types';

/** Idle tab title per route; the running timer's countdown takes precedence. */
const ROUTE_TITLE_KEYS: Record<string, TKey> = {
  '/pricing': 'route.title.pricing',
  '/help': 'route.title.help',
  '/privacy': 'route.title.privacy',
  '/terms': 'route.title.terms',
  '/refund': 'route.title.refund',
  '/login': 'route.title.login',
  '/reset-password': 'route.title.resetPassword',
  '/account': 'route.title.account',
};

export const DEFAULT_TITLE_KEY: TKey = 'route.title.default';

export function titleForPath(pathname: string, t: (key: TKey) => string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const key = ROUTE_TITLE_KEYS[path];
  return key ? `${t(key)} — Moneo` : t(DEFAULT_TITLE_KEY);
}
