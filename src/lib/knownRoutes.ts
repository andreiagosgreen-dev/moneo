/**
 * Every path the SPA router renders on purpose (`src/App.tsx` routes plus
 * `/welcome` from `src/main.tsx`). Shared by the client (not-found view) and
 * the Worker (HTTP 404 for the SPA shell), so both agree on what exists.
 * Keep dependency-free: the Worker typechecks and bundles this file too.
 */
const KNOWN_CLIENT_ROUTES = new Set([
  '/',
  '/welcome',
  '/help',
  '/pricing',
  '/login',
  '/reset-password',
  '/account',
  '/account/calendar-callback',
  '/terms',
  '/privacy',
  '/refund',
]);

export const KNOWN_CLIENT_ROUTE_LIST: readonly string[] = [...KNOWN_CLIENT_ROUTES];

/** React Router matches case-insensitively and ignores a trailing slash. */
export function isKnownClientRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return KNOWN_CLIENT_ROUTES.has((path || '/').toLowerCase());
}
