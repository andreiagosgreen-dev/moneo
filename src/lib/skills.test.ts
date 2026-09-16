import { describe, expect, it } from 'vitest';

import {
  FREE_SKILLS_LIMIT,
  MAX_RESOURCES,
  addResource,
  createSkillObject,
  deleteSkill,
  formatLearningDuration,
  loadSkills,
  logLearningMinutes,
  skillProgress,
  skillsByCategory,
  totalLearningMinutes,
  updateSkill,
} from './skills';

describe('skills', () => {
  it('exposes the Free tier limit (5 skills)', () => {
    expect(FREE_SKILLS_LIMIT).toBe(5);
  });

  it('creates a skill with beginner defaults', () => {
    const s = createSkillObject('React', 'frontend');
    expect(s.name).toBe('React');
    expect(s.category).toBe('frontend');
    expect(s.level).toBe(1);
    expect(s.targetLevel).toBe(3);
    expect(s.minutesLogged).toBe(0);
    expect(s.resources).toEqual([]);
  });

  it('loads an empty list when storage is empty', () => {
    expect(loadSkills()).toEqual([]);
  });

  it('updates level, target and certification', () => {
    const s = createSkillObject('TypeScript', 'frontend');
    const leveled = updateSkill([s], s.id, { level: 3 });
    expect(leveled[0].level).toBe(3);
    const certified = updateSkill(leveled, s.id, { certified: true });
    expect(certified[0].certified).toBe(true);
    const uncertified = updateSkill(certified, s.id, { certified: false });
    expect(uncertified[0].certified).toBeUndefined();
  });

  it('ignores invalid levels on update', () => {
    const s = createSkillObject('Go', 'backend');
    const next = updateSkill([s], s.id, { level: 9 as never });
    expect(next[0].level).toBe(1);
  });

  it('deletes a skill by id', () => {
    const a = createSkillObject('A');
    const b = createSkillObject('B');
    expect(deleteSkill([a, b], a.id)).toHaveLength(1);
  });

  it('logs learning minutes and rejects junk input', () => {
    const s = createSkillObject('Rust', 'backend');
    const logged = logLearningMinutes([s], s.id, 25);
    expect(logged[0].minutesLogged).toBe(25);
    expect(logLearningMinutes(logged, s.id, -5)).toBe(logged);
    expect(logLearningMinutes(logged, s.id, Number.NaN)).toBe(logged);
  });

  it('adds resources deduped and capped', () => {
    const s = createSkillObject('SQL', 'data');
    let list = [s];
    for (let i = 0; i < MAX_RESOURCES + 3; i++) {
      list = addResource(list, s.id, `https://example.com/${i}`);
    }
    expect(list[0].resources).toHaveLength(MAX_RESOURCES);
    const duped = addResource(list, s.id, 'https://example.com/0');
    expect(duped[0].resources).toHaveLength(MAX_RESOURCES);
  });

  it('measures progress toward the target level', () => {
    const s = createSkillObject('Vue', 'frontend');
    expect(skillProgress(s)).toBe(0); // level 1 of target 3
    const mid = updateSkill([s], s.id, { level: 2 });
    expect(skillProgress(mid[0])).toBe(0.5);
    const done = updateSkill([s], s.id, { level: 3 });
    expect(skillProgress(done[0])).toBe(1);
  });

  it('aggregates minutes and groups by category', () => {
    const a = { ...createSkillObject('A', 'frontend'), minutesLogged: 30 };
    const b = { ...createSkillObject('B', 'frontend'), minutesLogged: 45 };
    const c = { ...createSkillObject('C', 'backend'), minutesLogged: 15 };
    expect(totalLearningMinutes([a, b, c])).toBe(90);
    expect(skillsByCategory([a, b, c])).toEqual([
      { category: 'frontend', count: 2 },
      { category: 'backend', count: 1 },
    ]);
  });

  it('formats learning durations like project durations', () => {
    expect(formatLearningDuration(0)).toBe('0m');
    expect(formatLearningDuration(45)).toBe('45m');
    expect(formatLearningDuration(60)).toBe('1h');
    expect(formatLearningDuration(135)).toBe('2h 15m');
  });
});
