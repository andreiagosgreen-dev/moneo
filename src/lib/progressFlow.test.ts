import { describe, expect, it } from 'vitest';
import { planQuickStart } from './quickstart';
import { sessionProgressImpact } from './progress';
import { buildWeeklyRecap } from './recap';
import type { Session } from './store';

/**
 * First-"aha" flow regression: quickstart (goal → task) → one completed
 * session → visible project payoff → week recap. Every link uses the real
 * production helpers, so a break anywhere in the chain fails here.
 */
describe('first-aha flow', () => {
  it('goal → task → session → meter payoff → weekly recap', () => {
    const now = Date.now();

    // 1. Onboarding quickstart mints goal + project + first task.
    const plan = planQuickStart({ goalTitle: 'Launch the bakery site' });
    expect(plan).not.toBeNull();
    if (!plan) return;
    const projects = [plan.project];
    const tasks = [plan.task];
    const goals = plan.goal ? [plan.goal] : [];
    expect(goals).toHaveLength(1);

    // 2. One focus round completes on the preselected project/task.
    const entry: Session = {
      id: 's-aha',
      at: now,
      min: 25,
      projectId: plan.project.id,
      taskId: plan.task.id,
      intention: plan.task.title,
    };
    const history = [entry];

    // 3. The meter shows real movement, not a generic toast.
    const impact = sessionProgressImpact(entry, { projects, tasks, goals, history, now });
    expect(impact.kind).toBe('project');
    if (impact.kind !== 'project') return;
    expect(impact.projectName).toBe(plan.project.name);
    expect(impact.sessionMin).toBe(25);
    expect(impact.projectMinutes).toBe(25);
    expect(impact.goalTitle).toBe(plan.goal?.title);

    // 4. The same session feeds the weekly recap top movers.
    const recap = buildWeeklyRecap({ history, projects, tasks, goals, timezone: 'UTC' });
    expect(recap.sessionCount).toBe(1);
    expect(recap.totalMin).toBe(25);
    expect(recap.topProjects[0]?.projectId).toBe(plan.project.id);
  });
});
