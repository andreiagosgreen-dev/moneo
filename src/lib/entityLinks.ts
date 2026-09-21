/* Cross-entity links (Faza 14, extended Faza 19) — free-form many-to-many
 * edges between Goals, Projects, Skills, Journal entries and OKR
 * Objectives. A flat edge list, not an array-of-ids field on each entity:
 * with 5 linkable types, per-entity arrays would mean duplicated fields
 * across every lib file. One list also gives a single cleanup point when
 * an entity is deleted.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';

export type LinkEntityType = 'goal' | 'project' | 'skill' | 'journal' | 'objective';

const LINK_ENTITY_TYPES: LinkEntityType[] = [
  'goal',
  'project',
  'skill',
  'journal',
  'objective',
];

export interface EntityLink {
  id: string;
  aType: LinkEntityType;
  aId: string;
  bType: LinkEntityType;
  bId: string;
  createdAt: number;
}

function isEntityType(v: unknown): v is LinkEntityType {
  return typeof v === 'string' && LINK_ENTITY_TYPES.includes(v as LinkEntityType);
}

/** Load links, defaulting malformed entries away. Never throws. */
export function loadLinks(): EntityLink[] {
  const stored = read<EntityLink[]>(STORAGE_KEYS.links);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter(
      (l) =>
        l &&
        typeof l.id === 'string' &&
        isEntityType(l.aType) &&
        typeof l.aId === 'string' &&
        l.aId &&
        isEntityType(l.bType) &&
        typeof l.bId === 'string' &&
        l.bId,
    )
    .map((l) => ({
      id: l.id,
      aType: l.aType,
      aId: l.aId,
      bType: l.bType,
      bId: l.bId,
      createdAt: typeof l.createdAt === 'number' ? l.createdAt : Date.now(),
    }));
}

export function saveLinks(links: EntityLink[]): boolean {
  return write(STORAGE_KEYS.links, links);
}

function sameEdge(
  l: EntityLink,
  aType: LinkEntityType,
  aId: string,
  bType: LinkEntityType,
  bId: string,
): boolean {
  return (
    (l.aType === aType && l.aId === aId && l.bType === bType && l.bId === bId) ||
    (l.aType === bType && l.aId === bId && l.bType === aType && l.bId === aId)
  );
}

/**
 * Add a link between two entities. Rejects a self-link (same type+id) and
 * dedupes A-B against an existing B-A. Returns the list unchanged on
 * rejection/duplicate. Never throws.
 */
export function createLink(
  links: EntityLink[],
  aType: LinkEntityType,
  aId: string,
  bType: LinkEntityType,
  bId: string,
): EntityLink[] {
  if (aType === bType && aId === bId) return links;
  if (links.some((l) => sameEdge(l, aType, aId, bType, bId))) return links;
  const link: EntityLink = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `link-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    aType,
    aId,
    bType,
    bId,
    createdAt: Date.now(),
  };
  return [...links, link];
}

export function removeLink(links: EntityLink[], linkId: string): EntityLink[] {
  return links.filter((l) => l.id !== linkId);
}

/** Links touching a given entity, in either direction. Never throws. */
export function linksFor(links: EntityLink[], type: LinkEntityType, id: string): EntityLink[] {
  return links.filter(
    (l) => (l.aType === type && l.aId === id) || (l.bType === type && l.bId === id),
  );
}

/** The "other side" of a link relative to a known entity. */
export function otherSide(
  link: EntityLink,
  type: LinkEntityType,
  id: string,
): { type: LinkEntityType; id: string } {
  return link.aType === type && link.aId === id
    ? { type: link.bType, id: link.bId }
    : { type: link.aType, id: link.aId };
}

/** Strip every link touching a deleted entity. Call this from every delete site. */
export function cleanupLinksFor(
  links: EntityLink[],
  type: LinkEntityType,
  id: string,
): EntityLink[] {
  return links.filter((l) => !((l.aType === type && l.aId === id) || (l.bType === type && l.bId === id)));
}
