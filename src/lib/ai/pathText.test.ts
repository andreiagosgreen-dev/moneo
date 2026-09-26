import { describe, expect, it } from 'vitest';
import { materializeBuiltPath, isTplFrame } from './pathText';
import { buildPath, resolveInput } from './planner';

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
});
