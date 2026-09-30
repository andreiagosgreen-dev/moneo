/** Initial in-app destination for app deep links and a clean first run. */
export function initialAppTab(search: string, hasExistingWork: boolean): 'focus' | 'today' {
  if (new URLSearchParams(search).get('action') === 'focus') return 'focus';
  return hasExistingWork ? 'focus' : 'today';
}
