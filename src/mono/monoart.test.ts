import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MonoArt, MonoGlyph, type ArtName, type GlyphName } from './MonoArt';
import MonoEmpty from './MonoEmpty';

const ARTS: ArtName[] = ['chart', 'folder', 'target', 'graph', 'sprout', 'calendar'];
const GLYPHS: GlyphName[] = [
  'flag',
  'clock',
  'flame',
  'folderCheck',
  'checks',
  'rank1',
  'rank2',
  'rank3',
  'cap',
  'run',
  'box',
  'book',
  'target',
  'globe',
  'briefcase',
  'sparkle',
];

describe('MonoArt', () => {
  it.each(ARTS)('draws %s as decorative line art with an accent stroke', (name) => {
    const html = renderToStaticMarkup(createElement(MonoArt, { name }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).toContain('mono-art-a');
  });

  it.each(GLYPHS)('draws glyph %s', (name) => {
    const html = renderToStaticMarkup(createElement(MonoGlyph, { name }));
    expect(html).toContain('class="mono-glyph"');
    expect(html).toMatch(/<(path|circle|rect)/);
  });

  it('sits inside the empty state with title, body and action', () => {
    const html = renderToStaticMarkup(
      createElement(MonoEmpty, {
        art: createElement(MonoArt, { name: 'chart' }),
        title: 'Nothing yet',
        body: 'Finish one round.',
        action: createElement('button', null, 'Start'),
      }),
    );
    expect(html).toContain('mono-empty-art');
    expect(html).toContain('Nothing yet');
    expect(html).toContain('<button>Start</button>');
  });
});
