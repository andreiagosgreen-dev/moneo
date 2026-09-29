/* Curated icons for habits and tasks. Glyphs are user data, never UI copy. */

export const ICONS: readonly string[] = [
  // study + work
  '📚',
  '✏️',
  '🎓',
  '🧠',
  '💻',
  '📝',
  '📊',
  '💼',
  // sport + health
  '🏃',
  '🚴',
  '🏋️',
  '🧘',
  '🏊',
  '🚶',
  '💧',
  '🍎',
  // sleep + mind
  '😴',
  '🌙',
  '☀️',
  '🙏',
  '💊',
  '🦷',
  '🥗',
  '☕',
  // home + money
  '🏠',
  '🧹',
  '🧺',
  '🪴',
  '🛒',
  '💰',
  '💳',
  '📦',
  // social + creative
  '👪',
  '💬',
  '📞',
  '❤️',
  '🎨',
  '🎸',
  '📷',
  '✍️',
  // nature + other
  '🌳',
  '🐕',
  '🌍',
  '✈️',
  '🎯',
  '⭐',
  '🔥',
  '🎉',
];

const ALLOWED = new Set(ICONS);

export function isAllowedIcon(v: unknown): v is string {
  return typeof v === 'string' && ALLOWED.has(v);
}
