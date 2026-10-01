/**
 * After `vite build`: write a prerendered landing page per language
 * (dist/welcome/index.html for English, dist/<lang>/index.html for the rest)
 * and add hreflang + structured data to dist/index.html.
 *
 * Each page is the built shell with localized head tags, the landing CSS
 * linked up front (no unstyled flash) and the rendered landing inside #root.
 * The SPA boots as usual and replaces that markup. Rendering goes through
 * Vite's SSR loader, so the landing code is shared, not duplicated.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const shell = await readFile(join(dist, 'index.html'), 'utf8');
const assets = await readdir(join(dist, 'assets'));
const landingCss = assets.filter((f) => /^LandingPage-[\w-]+\.css$/.test(f));

/** Drop the shell's generic tags that each page replaces. */
function stripHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace(/<meta\s+property="og:(url|title|description)"[\s\S]*?\/>\s*/g, '')
    .replace(/<meta\s+name="twitter:(title|description)"[\s\S]*?\/>\s*/g, '');
}

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

// The landing's layout effects only run in the browser; the warning is noise here.
const consoleError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes('useLayoutEffect does nothing on the server')) return;
  consoleError(...args);
};

try {
  const mod = await vite.ssrLoadModule('/src/landing/prerender.tsx');
  const pages = [];
  for (const locale of mod.PRERENDER_LOCALES) pages.push(await mod.prerenderLanding(locale));

  const cssLinks = landingCss
    .map((f) => `<link rel="stylesheet" crossorigin href="/assets/${f}" />`)
    .join('\n    ');

  for (const page of pages) {
    let html = stripHead(shell)
      .replace(/<html lang="[^"]*"/, `<html lang="${page.locale}"`)
      .replace('</head>', `    ${page.head}\n    ${cssLinks}\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root">${page.body}</div>`);
    const dir = join(dist, page.path.slice(1));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), html);
  }

  // The root shell (app for returning visitors) only points search engines at
  // the language pages; it keeps its own content and canonical.
  const en = pages.find((p) => p.locale === 'en');
  const alternates = en.head
    .split('\n')
    .filter((l) => l.includes('hreflang') || l.includes('application/ld+json'))
    .join('\n    ');
  const rootHtml = shell.replace(
    '</head>',
    `    <link rel="canonical" href="https://moneo.bond/" />\n    ${alternates}\n  </head>`,
  );
  await writeFile(join(dist, 'index.html'), rootHtml);

  console.log(`prerender-landing: ${pages.map((p) => p.path).join(' ')}`);
} finally {
  console.error = consoleError;
  await vite.close();
}
