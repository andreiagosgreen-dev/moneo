import { describe, expect, it } from 'vitest';
import { initialAppTab } from './appLaunch';

describe('initialAppTab', () => {
  it('opens Focus for the PWA Focus shortcut, including a clean profile', () => {
    expect(initialAppTab('?action=focus', false)).toBe('focus');
  });

  it('keeps the normal first-run destination on Today', () => {
    expect(initialAppTab('', false)).toBe('today');
  });

  it('keeps returning users on Focus unless a supported action overrides it', () => {
    expect(initialAppTab('', true)).toBe('focus');
    expect(initialAppTab('?action=unknown', false)).toBe('today');
  });
});
