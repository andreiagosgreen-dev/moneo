import { describe, expect, it } from 'vitest';
import { planQuickStart } from './quickstart';
import { createProjectObject, type Project } from './projects';

function existingProject(): Project {
  return { ...createProjectObject('Side quest', 'work'), id: 'p-exist' };
}

describe('planQuickStart', () => {
  it('mints a linked goal + project + suggested first task', () => {
    const plan = planQuickStart({ goalTitle: 'Launch the bakery site' });
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.createdProject).toBe(true);
    expect(plan.project.name).toBe('Launch the bakery site');
    expect(plan.task.projectId).toBe(plan.project.id);
    expect(plan.task.title.length).toBeGreaterThan(0);
    expect(plan.goal).not.toBeNull();
    expect(plan.goal?.projectId).toBe(plan.project.id);
    expect(plan.goal?.level).toBe('project');
  });

  it('prefers the user-typed task over the suggestion', () => {
    const plan = planQuickStart({ goalTitle: 'Learn React', taskTitle: 'Finish hooks chapter' });
    expect(plan?.task.title).toBe('Finish hooks chapter');
  });

  it('returns null for a blank goal', () => {
    expect(planQuickStart({ goalTitle: '   ' })).toBeNull();
  });

  it('reuses an existing project and skips the goal at the caps', () => {
    const reuse = existingProject();
    const plan = planQuickStart({
      goalTitle: 'Get fit',
      existingProject: reuse,
      createGoal: false,
    });
    expect(plan?.createdProject).toBe(false);
    expect(plan?.project.id).toBe('p-exist');
    expect(plan?.task.projectId).toBe('p-exist');
    expect(plan?.goal).toBeNull();
  });
});
