/**
 * Turn BuiltPath frame ids (ai.tpl.*) into human titles before UI / approve.
 * BYOK paths already carry plain-language titles — those pass through.
 */
import type { BuiltPath } from './types';

export type PathTranslate = (key: string, vars: Record<string, string>) => string;

export function isTplFrame(text: string): boolean {
  return text.startsWith('ai.tpl.');
}

/** Resolve phase/milestone/task frame keys using the same two-pass as AiPathCard. */
export function materializeBuiltPath(path: BuiltPath, translate: PathTranslate): BuiltPath {
  const outcomeText = (phaseId: string): string => {
    const phase = path.phases.find((p) => p.id === phaseId);
    if (!phase) return '';
    return isTplFrame(phase.outcome)
      ? translate(phase.outcome, { goal: path.goal })
      : phase.outcome;
  };

  const phases = path.phases.map((p) => ({
    ...p,
    outcome: isTplFrame(p.outcome) ? translate(p.outcome, { goal: path.goal }) : p.outcome,
  }));

  const milestones = path.milestones.map((m) => {
    const outcome = outcomeText(m.phaseId);
    const title = isTplFrame(m.title) ? translate(m.title, { outcome, goal: path.goal }) : m.title;
    return { ...m, title };
  });

  const tasks = path.tasks.map((task) => {
    if (!isTplFrame(task.title)) return task;
    const ms = path.milestones.find((m) => m.id === task.milestoneId);
    const outcome = ms ? outcomeText(ms.phaseId) : '';
    return {
      ...task,
      title: translate(task.title, { goal: path.goal, outcome }).slice(0, 160),
    };
  });

  return { ...path, phases, milestones, tasks };
}
