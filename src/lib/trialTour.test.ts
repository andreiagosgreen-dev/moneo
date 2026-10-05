import { beforeEach, describe, expect, it } from 'vitest';
import { dismissTip, loadDismissedTips, tourTip, trialDay } from './trialTour';

const D = 86_400_000;
const CREATED = Date.UTC(2026, 9, 1, 9);

beforeEach(() => localStorage.clear());

describe('trial tour', () => {
  it('counts trial days from 1 on the sign-up day', () => {
    expect(trialDay(CREATED, CREATED + 1000)).toBe(1);
    expect(trialDay(CREATED, CREATED + D)).toBe(2);
    expect(trialDay(CREATED, CREATED + 4 * D - 1)).toBe(4);
  });

  it('suggests a plan, a workout and reports on days 2–4 only', () => {
    expect(tourTip(CREATED, [], CREATED + 1000)).toBeNull();
    expect(tourTip(CREATED, [], CREATED + D + 1000)).toBe('plan');
    expect(tourTip(CREATED, [], CREATED + 2 * D + 1000)).toBe('move');
    expect(tourTip(CREATED, [], CREATED + 3 * D + 1000)).toBe('reports');
    expect(tourTip(CREATED, [], CREATED + 4 * D + 1000)).toBeNull();
    expect(tourTip(undefined, [], CREATED)).toBeNull();
  });

  it('remembers dismissed tips and ignores junk', () => {
    expect(dismissTip('plan')).toEqual(['plan']);
    expect(tourTip(CREATED, loadDismissedTips(), CREATED + D + 1000)).toBeNull();
    localStorage.setItem('moneo:trial-tour', JSON.stringify(['move', 'nope', 3]));
    expect(loadDismissedTips()).toEqual(['move']);
  });
});
