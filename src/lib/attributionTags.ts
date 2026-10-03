/**
 * Channel labels shared by the app and the Worker (dependency-free, no DOM):
 * the Worker re-cleans every label it receives with the same rule.
 */

/** Labels are short, lowercase and safe to store and count. */
export function cleanTag(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const tag = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 32);
  return /^[a-z0-9]/.test(tag) ? tag : '';
}
