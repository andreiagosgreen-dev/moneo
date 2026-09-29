/** Extensions that are build/static files — never SPA-fallback to index.html. */
const STATIC_ASSET_EXT = new Set([
  'js',
  'css',
  'map',
  'mjs',
  'json',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'webmanifest',
  'txt',
  'xml',
  'wasm',
]);

/**
 * True when the path looks like a missing static file (e.g. `/assets/x.js`).
 * Client routes like `/privacy` or `/account` have no extension → SPA OK.
 */
export function isStaticAssetPath(filePath: string): boolean {
  const base = filePath.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return false;
  return STATIC_ASSET_EXT.has(base.slice(dot + 1).toLowerCase());
}

/**
 * Paths that must revalidate on every request (never long immutable cache).
 * Service worker + webmanifest must update promptly after deploy.
 */
export function isRevalidateAlwaysPath(filePath: string): boolean {
  return (
    filePath === '/index.html' || filePath === '/sw.js' || filePath === '/manifest.webmanifest'
  );
}

/** Unhashed SEO files: crawlers should see edits within the hour. */
const HOURLY_CACHE_PATHS = new Set(['/sitemap.xml', '/robots.txt']);

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  map: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json',
  xml: 'application/xml; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
};

export function getContentType(filePath: string): string {
  const base = filePath.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export function getCacheControl(filePath: string): string {
  if (isRevalidateAlwaysPath(filePath)) return 'public, max-age=0, must-revalidate';
  if (HOURLY_CACHE_PATHS.has(filePath)) return 'public, max-age=3600';
  return 'public, max-age=31536000, immutable';
}

/**
 * Unknown paths still get the SPA shell, but with status 404 so crawlers
 * don't index junk URLs. The route list is shared with the client router.
 */
export { KNOWN_CLIENT_ROUTE_LIST, isKnownClientRoute } from '../../src/lib/knownRoutes';
