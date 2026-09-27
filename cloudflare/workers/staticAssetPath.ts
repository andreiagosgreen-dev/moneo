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
