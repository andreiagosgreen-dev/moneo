/** Idle tab title per route; the running timer's countdown takes precedence. */
const ROUTE_TITLES: Record<string, string> = {
  '/pricing': 'Pricing — Moneo',
  '/help': 'Help — Moneo',
  '/privacy': 'Privacy Policy — Moneo',
  '/terms': 'Terms of Service — Moneo',
  '/login': 'Sign in — Moneo',
  '/reset-password': 'Reset password — Moneo',
  '/account': 'Account — Moneo',
};

export const DEFAULT_TITLE = 'Moneo — Focus Timer';

export function titleForPath(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_TITLES[path] ?? DEFAULT_TITLE;
}
