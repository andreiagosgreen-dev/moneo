import { describe, expect, it, beforeEach } from 'vitest';
import {
  coachDismissKey,
  dismissCoach,
  isCoachDismissed,
  pickProgramCoach,
  showCoachAgain,
  COACH_CTA,
  COACH_EXAMPLE_COUNT,
} from './programCoach';

describe('pickProgramCoach', () => {
  it('prioritises Today empty → open → done', () => {
    expect(
      pickProgramCoach({
        screen: 'today',
        planTaskCount: 0,
        planOpenCount: 0,
        hasBlocks: false,
      }),
    ).toBe('aziEmpty');
    expect(
      pickProgramCoach({
        screen: 'today',
        planTaskCount: 3,
        planOpenCount: 2,
        hasBlocks: true,
      }),
    ).toBe('aziOpen');
    expect(
      pickProgramCoach({
        screen: 'today',
        planTaskCount: 2,
        planOpenCount: 0,
        hasBlocks: false,
      }),
    ).toBe('aziDone');
  });

  it('on Focus: empty plan, then open items, else silent', () => {
    expect(
      pickProgramCoach({
        screen: 'focus',
        planTaskCount: 0,
        planOpenCount: 0,
        hasBlocks: false,
      }),
    ).toBe('focusEmpty');
    expect(
      pickProgramCoach({
        screen: 'focus',
        planTaskCount: 2,
        planOpenCount: 1,
        hasBlocks: false,
      }),
    ).toBe('focusOpen');
    expect(
      pickProgramCoach({
        screen: 'focus',
        planTaskCount: 2,
        planOpenCount: 0,
        hasBlocks: true,
      }),
    ).toBeNull();
  });

  it('on Orar: empty vs has blocks', () => {
    expect(
      pickProgramCoach({
        screen: 'orar',
        planTaskCount: 0,
        planOpenCount: 0,
        hasBlocks: false,
      }),
    ).toBe('orarEmpty');
    expect(
      pickProgramCoach({
        screen: 'orar',
        planTaskCount: 3,
        planOpenCount: 1,
        hasBlocks: true,
      }),
    ).toBe('orarHas');
  });
});

describe('coach dismiss storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips dismiss per day and kind', () => {
    expect(isCoachDismissed('2026-9-26', 'aziEmpty')).toBe(false);
    dismissCoach('2026-9-26', 'aziEmpty');
    expect(isCoachDismissed('2026-9-26', 'aziEmpty')).toBe(true);
    expect(isCoachDismissed('2026-9-26', 'aziOpen')).toBe(false);
    expect(localStorage.getItem(coachDismissKey('2026-9-26', 'aziEmpty'))).toBe('1');
    showCoachAgain('2026-9-26', 'aziEmpty');
    expect(isCoachDismissed('2026-9-26', 'aziEmpty')).toBe(false);
  });
});

describe('coach metadata', () => {
  it('maps examples and CTAs for every kind', () => {
    expect(COACH_EXAMPLE_COUNT.aziEmpty).toBe(3);
    expect(COACH_CTA.aziOpen).toBe('goWork');
    expect(COACH_CTA.focusEmpty).toBe('writePlan');
    expect(COACH_CTA.aziDone).toBe('shutdown');
    expect(COACH_CTA.orarHas).toBeNull();
  });
});
