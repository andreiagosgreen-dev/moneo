/** Locale weekday + day + month ("Vineri, 18 septembrie"), capitalized. */
export function dayLabel(tag: string): string {
  try {
    const s = new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return '';
  }
}
