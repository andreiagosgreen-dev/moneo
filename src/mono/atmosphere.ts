import { STORAGE_KEYS } from '../lib/storage/storageKeys';
import { FIRST_STEPS_REWARD, hasFirstStepsReward } from '../lib/firstSteps';
import { safeRead, safeWrite } from '../lib/storage/storageAdapter';
import type { TKey } from '../lib/i18n/types';
import { isAtmosphereUnlockedByRank } from '../lib/rankRewards';
import type { RankId } from '../lib/xpCore';

/** Classic Focus atmospheres — free for everyone. */
export const FREE_ATMOSPHERES = [
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

/** Interior-design Pro packs — gated on subscription. */
export const PRO_ATMOSPHERES = [
  'azur',
  'salvie',
  'zare',
  'crema',
  'citron',
  'liliac',
  'cobalt',
  'adanc',
  'galerie',
  'lavanda',
  'maslin',
  'jar',
  'bordo',
  'livada',
  'rosa',
  'turcoaz',
  'pruna',
  'nuc',
  'vin',
  'panza',
  'merlot',
  'fildes',
] as const;

/** Emotional skins of the same focus session — colors only, one shared layout. */
export const ATMOSPHERES = [...FREE_ATMOSPHERES, ...PRO_ATMOSPHERES] as const;
export type Atmosphere = (typeof ATMOSPHERES)[number];
export type FreeAtmosphere = (typeof FREE_ATMOSPHERES)[number];
export type ProAtmosphere = (typeof PRO_ATMOSPHERES)[number];

export const DEFAULT_ATMOSPHERE: Atmosphere = 'ritual';

/** i18n keys for atmosphere names (shared by Settings picker). */
export const ATMOSPHERE_LABEL: Record<Atmosphere, TKey> = {
  hartie: 'mono.atm.hartie',
  sanctuar: 'mono.atm.sanctuar',
  clar: 'mono.atm.clar',
  ritual: 'mono.atm.ritual',
  zori: 'mono.atm.zori',
  atelier: 'mono.atm.atelier',
  capitol: 'mono.atm.capitol',
  tarm: 'mono.atm.tarm',
  noapte: 'mono.atm.noapte',
  ceara: 'mono.atm.ceara',
  zapada: 'mono.atm.zapada',
  carbune: 'mono.atm.carbune',
  gradina: 'mono.atm.gradina',
  ceramica: 'mono.atm.ceramica',
  cerneala: 'mono.atm.cerneala',
  aurora: 'mono.atm.aurora',
  piatra: 'mono.atm.piatra',
  miere: 'mono.atm.miere',
  mare: 'mono.atm.mare',
  lampa: 'mono.atm.lampa',
  azur: 'mono.atm.azur',
  salvie: 'mono.atm.salvie',
  zare: 'mono.atm.zare',
  crema: 'mono.atm.crema',
  citron: 'mono.atm.citron',
  liliac: 'mono.atm.liliac',
  cobalt: 'mono.atm.cobalt',
  adanc: 'mono.atm.adanc',
  galerie: 'mono.atm.galerie',
  lavanda: 'mono.atm.lavanda',
  maslin: 'mono.atm.maslin',
  jar: 'mono.atm.jar',
  bordo: 'mono.atm.bordo',
  livada: 'mono.atm.livada',
  rosa: 'mono.atm.rosa',
  turcoaz: 'mono.atm.turcoaz',
  pruna: 'mono.atm.pruna',
  nuc: 'mono.atm.nuc',
  vin: 'mono.atm.vin',
  panza: 'mono.atm.panza',
  merlot: 'mono.atm.merlot',
  fildes: 'mono.atm.fildes',
};

export function isAtmosphere(value: unknown): value is Atmosphere {
  return typeof value === 'string' && (ATMOSPHERES as readonly string[]).includes(value);
}

/** Interior Pro packs only; classic Focus atmospheres stay free. */
export function isProAtmosphere(id: Atmosphere): boolean {
  return (PRO_ATMOSPHERES as readonly string[]).includes(id);
}

/** Usable now: free ones, everything on Pro, or a Pro pack the rank unlocked. */
export function isAtmosphereAvailable(id: Atmosphere, isPro: boolean, rank?: RankId): boolean {
  if (id === FIRST_STEPS_REWARD && hasFirstStepsReward()) return true;
  return isPro || !isProAtmosphere(id) || isAtmosphereUnlockedByRank(id, rank);
}

/** What actually paints: Pro packs apply on Pro or once the rank unlocked them. */
export function resolveAtmosphere(
  atmosphere: Atmosphere,
  isPro: boolean,
  rank?: RankId,
): Atmosphere {
  return isAtmosphereAvailable(atmosphere, isPro, rank) ? atmosphere : DEFAULT_ATMOSPHERE;
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
