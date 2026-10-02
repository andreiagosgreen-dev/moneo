import { describe, expect, it } from 'vitest';
import { materializeBuiltPath, isTplFrame } from './pathText';
import { buildPath, resolveInput } from './planner';
import { createI18n } from '../i18n';
import { de } from '../i18n/locales/de';
import { en } from '../i18n/locales/en';
import { es } from '../i18n/locales/es';
import { fr } from '../i18n/locales/fr';
import { it as itLocale } from '../i18n/locales/it';
import { ro } from '../i18n/locales/ro';
import { ru } from '../i18n/locales/ru';
import { uk } from '../i18n/locales/uk';
import type { PathKind } from './types';

describe('pathText', () => {
  it('detects template frame keys', () => {
    expect(isTplFrame('ai.tpl.taskSpec')).toBe(true);
    expect(isTplFrame('Order BOM parts')).toBe(false);
  });

  it('materializes build path frames into readable titles', () => {
    const path = buildPath(
      resolveInput({
        text: 'Build a drone',
        horizonMonths: 6,
        level: 'beginner',
        hoursPerWeek: 5,
        kind: 'build',
      }),
    );
    expect(path.kind).toBe('build');
    expect(path.tasks[0]?.title.startsWith('ai.tpl.')).toBe(true);

    const rendered = materializeBuiltPath(path, (key, vars) => {
      if (key === 'ai.tpl.taskSpec') return `Spec ${vars.goal}: ${vars.outcome}`;
      if (key.startsWith('ai.tpl.phase')) return `Phase for ${vars.goal}`;
      if (key.startsWith('ai.tpl.ms')) return `MS ${vars.outcome}`;
      return `${key}:${vars.goal}`;
    });
    expect(rendered.tasks[0]?.title.startsWith('ai.tpl.')).toBe(false);
    expect(rendered.tasks[0]?.title).toContain('Build a drone');
  });

  it('leaves BYOK plain titles unchanged', () => {
    const path = buildPath(resolveInput({ text: 'x', horizonMonths: 3, hoursPerWeek: 5 }));
    const plain = {
      ...path,
      tasks: path.tasks.map((t, i) => ({ ...t, title: `Step ${i + 1}` })),
    };
    const out = materializeBuiltPath(plain, () => 'SHOULD_NOT_RUN');
    expect(out.tasks.map((t) => t.title)).toEqual(plain.tasks.map((t) => t.title));
  });

  it('reads cleanly: real titles never repeat the goal, in every language', () => {
    const goal = 'Învăț o abilitate cu practică săptămânală';
    const dicts = { en, ro, ru, uk, de, fr, es, it: itLocale };
    const kinds: PathKind[] = ['learning', 'launch', 'build', 'general'];
    for (const [lang, dict] of Object.entries(dicts)) {
      const { t } = createI18n(lang as 'en', dict);
      for (const kind of kinds) {
        const path = buildPath(
          resolveInput({ text: goal, horizonMonths: 12, hoursPerWeek: 5, kind }),
        );
        const out = materializeBuiltPath(path, (key, vars) => t(key as never, vars));
        const titles = [
          ...out.tasks.map((x) => x.title),
          ...out.milestones.map((m) => m.title),
          ...out.phases.map((p) => p.outcome),
        ];
        for (const title of titles) {
          expect(title, `${lang}/${kind}`).not.toContain(goal);
          expect(title, `${lang}/${kind}`).not.toContain('ai.tpl.');
          expect(title, `${lang}/${kind}`).not.toMatch(/\{\w+\}/);
        }
      }
    }
  });
});
