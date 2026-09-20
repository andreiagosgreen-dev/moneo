import { describe, expect, it } from 'vitest';
import { openExternal, safeExternalUrl } from './links';

describe('safeExternalUrl', () => {
  it('accepts https/http URLs and normalizes them', () => {
    expect(safeExternalUrl('https://example.com/x?q=1')).toBe('https://example.com/x?q=1');
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/');
    expect(safeExternalUrl('  HTTPS://EXAMPLE.COM/A  ')).toBe('https://example.com/A');
  });

  it('upgrades bare domains to https', () => {
    expect(safeExternalUrl('example.com/notes')).toBe('https://example.com/notes');
  });

  it('rejects dangerous schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<h1>x</h1>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(safeExternalUrl('ftp://files.example.com/x')).toBeNull();
  });

  it('rejects non-URLs, notes and oversized input', () => {
    // Protocol-relative input is force-upgraded to https — safe to open.
    expect(safeExternalUrl('//evil.com/x')).toBe('https://evil.com/x');
    expect(safeExternalUrl('just some notes')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(42)).toBeNull();
    expect(safeExternalUrl(`https://example.com/${'a'.repeat(2000)}`)).toBeNull();
  });
});

describe('openExternal', () => {
  it('returns false when the popup is blocked (jsdom)', () => {
    expect(openExternal('https://example.com')).toBe(false);
  });
});
