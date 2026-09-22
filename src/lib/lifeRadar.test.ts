import { describe, expect, it } from 'vitest';
import {
  buildWheelAssistPrompt,
  clampWheelScore,
  labelPoint,
  lowestSatisfaction,
  polarPoint,
  radarPolygon,
  rankNeglected,
  ruleBasedWheelCoach,
  scoreRadius,
  spokeAngle,
} from './lifeRadar';
import type { LifeMapArea } from './lifemap';

function area(overrides: Partial<LifeMapArea> = {}): LifeMapArea {
  return {
    id: overrides.id ?? 'a1',
    name: overrides.name ?? 'Health',
    color: '#3ecf8e',
    icon: '❤️',
    currentScore: 5,
    desiredScore: 8,
    importance: 4,
    intention: 'Move daily.',
    linkedGoalIds: [],
    linkedProjectIds: [],
    linkedHabitIds: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('lifeRadar geometry', () => {
  it('puts 0° at the top', () => {
    const p = polarPoint(100, 100, 50, 0);
    expect(p.x).toBeCloseTo(100, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });

  it('clamps wheel scores and maps radius', () => {
    expect(clampWheelScore(0)).toBe(1);
    expect(clampWheelScore(99)).toBe(10);
    expect(clampWheelScore(NaN)).toBe(1);
    expect(scoreRadius(1, 100)).toBeCloseTo(12, 5);
    expect(scoreRadius(10, 100)).toBeCloseTo(100, 5);
  });

  it('builds an n-gon and even spokes', () => {
    expect(spokeAngle(0, 4)).toBe(0);
    expect(spokeAngle(1, 4)).toBe(90);
    const poly = radarPolygon([10, 10, 10, 10], 100, 100, 80);
    expect(poly.split(' ')).toHaveLength(4);
    expect(radarPolygon([], 100, 100, 80)).toBe('');
    const lbl = labelPoint(0, 4, 100, 100, 80, 20);
    expect(lbl.y).toBeLessThan(100);
  });
});

describe('lifeRadar coaching', () => {
  it('ranks neglected by weighted gap', () => {
    const ranked = rankNeglected([
      area({ id: 'ok', currentScore: 8, desiredScore: 8, importance: 5 }),
      area({ id: 'side', name: 'Side', currentScore: 3, desiredScore: 8, importance: 2 }),
      area({ id: 'core', name: 'Core', currentScore: 4, desiredScore: 9, importance: 5 }),
    ]);
    expect(ranked[0].id).toBe('core');
    expect(lowestSatisfaction([area({ id: 'hi', currentScore: 9 }), area({ id: 'lo', currentScore: 2 })])!.id).toBe(
      'lo',
    );
  });

  it('builds mode-specific prompts and local coach copy', () => {
    const areas = [area({ name: 'Rest', currentScore: 3, desiredScore: 8, importance: 5 })];
    expect(buildWheelAssistPrompt(areas, 'reflect')).toContain('Rest');
    expect(buildWheelAssistPrompt(areas, 'reflect')).toContain('reflection');
    expect(buildWheelAssistPrompt(areas, 'action')).toContain('tiny next action');
    expect(ruleBasedWheelCoach(areas, 'reflect')).toContain('Rest');
    expect(ruleBasedWheelCoach(areas, 'action')).toContain('Rest');
    expect(ruleBasedWheelCoach([], 'reflect')).toMatch(/map|carte|карт|Karte|mappa|mapa/i);
  });
});
