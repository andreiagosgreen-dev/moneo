import { beforeEach, describe, expect, it } from 'vitest';
import {
  FIRST_STEPS_REWARD,
  firstStepsProgress,
  firstStepsView,
  hasFirstStepsReward,
  loadFirstSteps,
  saveFirstSteps,
} from './firstSteps';
import { isAtmosphereAvailable } from '../mono/atmosphere';

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 6, 12);

beforeEach(() => localStorage.clear());

describe('first steps', () => {
  it('shows for an account created this week and not for an older one', () => {
    expect(firstStepsView({}, NOW - 2 * D, NOW)).toBe('steps');
    expect(firstStepsView({}, NOW - 8 * D, NOW)).toBeNull();
  });

  it('shows on a device that started empty, even without an account', () => {
    expect(firstStepsView({ startedAt: NOW - D }, undefined, NOW)).toBe('steps');
    expect(firstStepsView({}, undefined, NOW)).toBeNull();
  });

  it('celebrates for a while after all three, then hides; dismissed stays hidden', () => {
    expect(firstStepsView({ doneAt: NOW - H }, NOW - D, NOW)).toBe('celebrate');
    expect(firstStepsView({ doneAt: NOW - 2 * D }, NOW - 3 * D, NOW)).toBeNull();
    expect(firstStepsView({ dismissedAt: NOW - H }, NOW - D, NOW)).toBeNull();
  });

  it('counts the steps done', () => {
    expect(firstStepsProgress({ task: true, focus: false, try: true }).count).toBe(2);
  });

  it('round-trips and keeps only known steps', () => {
    saveFirstSteps({ startedAt: 5, counted: ['task', 'focus'] });
    localStorage.setItem(
      'moneo:first-steps',
      JSON.stringify({ startedAt: 5, counted: ['task', 'nope'], doneAt: 'x' }),
    );
    expect(loadFirstSteps()).toEqual({ startedAt: 5, counted: ['task'] });
  });

  it('unlocks the reward theme on the free plan once done', () => {
    expect(hasFirstStepsReward()).toBe(false);
    expect(isAtmosphereAvailable(FIRST_STEPS_REWARD, false, 'beginner')).toBe(false);
    saveFirstSteps({ doneAt: NOW });
    expect(hasFirstStepsReward()).toBe(true);
    expect(isAtmosphereAvailable(FIRST_STEPS_REWARD, false, 'beginner')).toBe(true);
  });
});
