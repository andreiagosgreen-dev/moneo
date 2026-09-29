import { describe, expect, it } from 'vitest';
import { LANDING_FACTS } from './landingFacts';
import { LOCALES } from '../lib/i18n/meta';
import { ATMOSPHERES } from '../mono/atmosphere';

describe('landing facts', () => {
  it('match the real number of languages and atmospheres', () => {
    expect(LANDING_FACTS.languages).toBe(LOCALES.length);
    expect(LANDING_FACTS.atmospheres).toBe(ATMOSPHERES.length);
  });
});
