import type { LegalDocId } from './seller';

/** A paragraph, or a bulleted list. Text may carry inline tokens (see tokens.ts). */
export type LegalBlock = string | { list: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  title: string;
  /** "Last updated: …" line, already formatted. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
}

export type LegalSet = Record<LegalDocId, LegalDoc>;
