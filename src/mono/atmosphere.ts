import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import { safeRead, safeWrite } from '../lib/storage/storageAdapter';

/** Emotional skins of the same focus session — colors only, one shared layout. */
export const ATMOSPHERES = [
  'hartie',
  'sanctuar',
  'clar',
  'ritual',
  'zori',
  'atelier',
  'capitol',
  'tarm',
  'noapte',
  'ceara',
  'zapada',
  'carbune',
  'gradina',
  'ceramica',
  'cerneala',
  'aurora',
  'piatra',
  'miere',
  'mare',
  'lampa',
] as const;
export type Atmosphere = (typeof ATMOSPHERES)[number];

export const DEFAULT_ATMOSPHERE: Atmosphere = 'ritual';

export function isAtmosphere(value: unknown): value is Atmosphere {
  return typeof value === 'string' && (ATMOSPHERES as readonly string[]).includes(value);
}

export function loadAtmosphere(): Atmosphere {
  const stored = safeRead<unknown>(STORAGE_KEYS.atmosphere);
  return isAtmosphere(stored) ? stored : DEFAULT_ATMOSPHERE;
}

export function saveAtmosphere(atmosphere: Atmosphere): boolean {
  return safeWrite(STORAGE_KEYS.atmosphere, atmosphere);
}

/** Mirror the chosen atmosphere onto <html> so color tokens cascade app-wide. */
export function applyAtmosphere(atmosphere: Atmosphere): void {
  document.documentElement.dataset.atmosphere = atmosphere;
}
