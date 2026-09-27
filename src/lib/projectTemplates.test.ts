import { describe, expect, it } from 'vitest';

import {
  PROJECT_TEMPLATES,
  availableTemplates,
  getTemplateById,
  instantiateTemplate,
} from './projectTemplates';

describe('projectTemplates', () => {
  it('ships seven blueprints across all project categories', () => {
    expect(PROJECT_TEMPLATES).toHaveLength(7);
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(7);
  });

  it('gates pro blueprints behind Pro (free sees starters only)', () => {
    const free = availableTemplates(false);
    const pro = availableTemplates(true);
    expect(free.length).toBeGreaterThan(0);
    expect(free.length).toBeLessThan(pro.length);
    expect(free.every((t) => !t.pro)).toBe(true);
    expect(pro).toHaveLength(PROJECT_TEMPLATES.length);
  });

  it('finds templates by id', () => {
    expect(getTemplateById('web-app')?.name).toBe('Web App');
    expect(getTemplateById('nope')).toBeNull();
  });

  it('instantiates a project with linked starter tasks', () => {
    const template = getTemplateById('web-app')!;
    const { project, tasks } = instantiateTemplate(template);
    expect(project.name).toBe('Web App');
    expect(project.color).toBe(template.color);
    expect(project.category).toBe(template.category);
    expect(tasks).toHaveLength(template.tasks.length);
    expect(tasks.every((t) => t.projectId === project.id)).toBe(true);
    expect(tasks.every((t) => t.status === 'pending')).toBe(true);
  });

  it('accepts a custom project name on instantiate', () => {
    const template = getTemplateById('rest-api')!;
    const { project } = instantiateTemplate(template, '  Billing API  ');
    expect(project.name).toBe('Billing API');
  });

  it('carries priorities from the blueprint', () => {
    const template = getTemplateById('client-onboarding')!;
    const { tasks } = instantiateTemplate(template);
    const byTitle = new Map(tasks.map((t) => [t.title, t.priority]));
    expect(byTitle.get('Discovery call + written scope')).toBe('p0');
  });

  it('documents stack, practices and pitfalls for every template', () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(t.stack.length).toBeGreaterThan(0);
      expect(t.bestPractices.length).toBeGreaterThan(0);
      expect(t.pitfalls.length).toBeGreaterThan(0);
      expect(t.tasks.length).toBeGreaterThan(0);
    }
  });
});
