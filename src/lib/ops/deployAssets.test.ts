import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs build script without type declarations
import { changedKeys, uploadRank } from '../../../scripts/deploy-assets.mjs';

describe('deploy-assets', () => {
  it('uploads hashed assets first and the shell last', () => {
    const keys = ['index.html', 'sw.js', 'robots.txt', 'assets/index-abc.js', 'registerSW.js'];
    const sorted = [...keys].sort((a, b) => uploadRank(a) - uploadRank(b));
    expect(sorted[0]).toBe('assets/index-abc.js');
    expect(sorted[sorted.length - 1]).toBe('index.html');
    expect(uploadRank('workbox-1234.js')).toBe(2);
  });

  it('re-uploads only new or changed files', () => {
    const previous = { 'index.html': 'a', 'assets/x.js': 'b', 'robots.txt': 'c' };
    const current = {
      'index.html': 'a2',
      'assets/x.js': 'b',
      'assets/y.js': 'd',
      'robots.txt': 'c',
    };
    expect(changedKeys(current, previous).sort()).toEqual(['assets/y.js', 'index.html']);
    expect(changedKeys(current, {}).length).toBe(4);
  });
});
