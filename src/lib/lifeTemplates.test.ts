import { describe, expect, it } from 'vitest';
import { createI18n } from './i18n';
import { en } from './i18n/locales/en';
import { ro } from './i18n/locales/ro';
import {
  FREE_LIFE_TEMPLATES,
  getLifeTemplate,
  instantiateLifeTemplate,
  isTemplateAvailable,
  LIFE_TEMPLATES,
  tplKey,
  type LifeTemplate,
} from './lifeTemplates';
import { FREE_HABITS_LIMIT } from './habits';
import { localDayKey } from './projects';
import { weekdayIndexMon } from './dayKeys';

const i18n = createI18n('en');
// Wednesday 2026-09-30, 09:15 local.
const NOW = new Date(2026, 8, 30, 9, 15).getTime();
const ctx = (over: Partial<Parameters<typeof instantiateLifeTemplate>[1]> = {}) => ({
  t: i18n.t,
  now: NOW,
  isPro: true,
  existingActiveHabits: 0,
  ...over,
});
const tpl = (id: string) => getLifeTemplate(id) as LifeTemplate;
const isNoon = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() === 12 && d.getMinutes() === 0;
};

describe('lifeTemplates', () => {
  it('ships 18 templates, 5 of them free', () => {
    expect(LIFE_TEMPLATES).toHaveLength(18);
    expect(FREE_LIFE_TEMPLATES).toEqual([
      'exam',
      'reading',
      'newHabit',
      'procrastination',
      'sleep',
    ]);
    expect(new Set(LIFE_TEMPLATES.map((t) => t.id)).size).toBe(18);
    expect(new Set(LIFE_TEMPLATES.map((t) => t.color)).size).toBe(18);
  });

  it('availability matrix: Free gets the 5 free ones, Pro gets all', () => {
    for (const t of LIFE_TEMPLATES) {
      expect(isTemplateAvailable(t.id, true)).toBe(true);
      expect(isTemplateAvailable(t.id, false)).toBe(FREE_LIFE_TEMPLATES.includes(t.id));
    }
  });

  it('every referenced key exists in en.ts', () => {
    const dict = en as Record<string, string>;
    for (const t of LIFE_TEMPLATES) {
      expect(dict[tplKey.name(t.id)]).toBeTruthy();
      expect(dict[tplKey.desc(t.id)]).toBeTruthy();
      for (const task of t.tasks) expect(dict[tplKey.task(t.id, task.key)]).toBeTruthy();
      for (const h of t.habits) expect(dict[tplKey.habit(t.id, h.key)]).toBeTruthy();
    }
  });

  it('every template instantiates with translated, non-empty titles', () => {
    for (const t of LIFE_TEMPLATES) {
      const r = instantiateLifeTemplate(t, ctx());
      expect(r.project.name).toBe(i18n.t(tplKey.name(t.id)));
      expect(r.project.name).not.toContain('goal.tpl');
      expect(r.tasks).toHaveLength(t.tasks.length);
      expect(r.habits).toHaveLength(t.habits.length);
      expect(r.skippedHabits).toBe(0);
      for (const task of r.tasks) {
        expect(task.title.length).toBeGreaterThan(0);
        expect(task.title).not.toContain('goal.tpl');
        expect(task.projectId).toBe(r.project.id);
      }
      for (const h of r.habits) {
        expect(h.targetPerWeek).toBeGreaterThanOrEqual(1);
        expect(h.targetPerWeek).toBeLessThanOrEqual(7);
      }
    }
  });

  it('exam prep: titles, priorities, due dates at local noon', () => {
    const r = instantiateLifeTemplate(tpl('exam'), ctx());
    expect(r.project.name).toBe('Exam prep');
    expect(r.project.category).toBe('learning');
    expect(r.tasks.map((t) => t.title)).toEqual([
      'List every topic in the syllabus',
      'Split topics across the days left',
      'Revision block',
      'Do a full practice test',
      'Light day before the exam',
    ]);
    const [syllabus, , revise, mock, rest] = r.tasks;
    expect(syllabus.priority).toBe('p1');
    expect(localDayKey(syllabus.dueAt!)).toBe('2026-9-30');
    expect(localDayKey(mock.dueAt!)).toBe('2026-10-14');
    expect(localDayKey(rest.dueAt!)).toBe('2026-10-20');
    for (const t of r.tasks) expect(isNoon(t.dueAt!)).toBe(true);
    expect(revise.estimateMin).toBe(50);
    expect(r.habits[0].name).toBe('Study 25 minutes');
    expect(r.habits[0].frequency).toBe('daily');
  });

  it('maps repeat rules and mirrors them to legacy recurrence', () => {
    const exam = instantiateLifeTemplate(tpl('exam'), ctx());
    const revise = exam.tasks[2];
    expect(revise.repeat).toEqual({ kind: 'weekdays' });
    expect(revise.recurrence).toBe('daily');
    expect(localDayKey(revise.dueAt!)).toBe('2026-9-30');

    const lang = instantiateLifeTemplate(tpl('language'), ctx());
    const talk = lang.tasks[2];
    expect(talk.repeat).toEqual({ kind: 'weeks', every: 1, weekdays: [5] });
    expect(talk.recurrence).toBe('weekly');
    expect(weekdayIndexMon(localDayKey(talk.dueAt!))).toBe(5);
    expect(localDayKey(talk.dueAt!)).toBe('2026-10-3');
  });

  it('weekday repeat starting on a weekend moves to Monday', () => {
    const saturday = new Date(2026, 9, 3, 10).getTime();
    const r = instantiateLifeTemplate(tpl('exam'), ctx({ now: saturday }));
    expect(localDayKey(r.tasks[2].dueAt!)).toBe('2026-10-5');
  });

  it('Free habit cap: skips what does not fit and reports it', () => {
    const r = instantiateLifeTemplate(
      tpl('sport'),
      ctx({ isPro: false, existingActiveHabits: FREE_HABITS_LIMIT - 1 }),
    );
    expect(r.habits).toHaveLength(1);
    expect(r.skippedHabits).toBe(1);

    const full = instantiateLifeTemplate(
      tpl('exam'),
      ctx({ isPro: false, existingActiveHabits: FREE_HABITS_LIMIT }),
    );
    expect(full.habits).toHaveLength(0);
    expect(full.skippedHabits).toBe(1);
    expect(full.tasks).toHaveLength(5);
  });

  it('Pro ignores the habit cap', () => {
    const r = instantiateLifeTemplate(tpl('sport'), ctx({ existingActiveHabits: 40 }));
    expect(r.habits).toHaveLength(2);
    expect(r.skippedHabits).toBe(0);
  });

  it('uses the active language at creation time', () => {
    const r = instantiateLifeTemplate(tpl('reading'), ctx({ t: createI18n('ro', ro).t }));
    expect(r.project.name).toBe('Citește mai mult');
    expect(r.habits[0].name).toBe('Citesc 20 de minute');
  });

  it('getLifeTemplate returns null for unknown ids', () => {
    expect(getLifeTemplate('nope')).toBeNull();
  });
});
