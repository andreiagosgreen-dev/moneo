/* Project templates (Roadmap Phase 1.3) — static blueprints, no storage.
 *
 * A template instantiates into a real project plus its starter tasks via
 * the existing createProjectObject / createTaskObject factories, so all
 * Free-tier limits and history wiring keep working unchanged.
 */
import { createProjectObject, type Project, type ProjectCategory } from './projects';
import { createTaskObject, type Task, type TaskPriority } from './tasks';

export interface TemplateTask {
  title: string;
  priority: TaskPriority;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: ProjectCategory;
  color: string;
  /** Suggested stack / tooling for this kind of project. */
  stack: string[];
  tasks: TemplateTask[];
  bestPractices: string[];
  pitfalls: string[];
  /** Pro-only blueprints; starters are free. */
  pro: boolean;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'web-app',
    name: 'Web App',
    description: 'Ship a small web app: setup, auth, core pages, deploy.',
    category: 'work',
    color: '#3b82f6',
    stack: ['React', 'TypeScript', 'Tailwind', 'Supabase'],
    tasks: [
      { title: 'Scaffold repo, lint, CI', priority: 'p1' },
      { title: 'Design data model + auth', priority: 'p0' },
      { title: 'Build core pages', priority: 'p1' },
      { title: 'Polish, test, deploy', priority: 'p2' },
    ],
    bestPractices: ['Deploy a stub on day one', 'One vertical slice at a time'],
    pitfalls: ['Gold-plating the UI before the data model works'],
    pro: false,
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description: 'Design, build and document a versioned HTTP API.',
    category: 'work',
    color: '#06b6d4',
    stack: ['Node.js', 'OpenAPI', 'Postgres', 'Vitest'],
    tasks: [
      { title: 'Write OpenAPI contract first', priority: 'p0' },
      { title: 'Implement routes + validation', priority: 'p1' },
      { title: 'Auth, rate limits, logging', priority: 'p1' },
      { title: 'Contract tests + docs', priority: 'p2' },
    ],
    bestPractices: ['Contract before code', 'Version from v1'],
    pitfalls: ['Breaking changes without a version bump'],
    pro: true,
  },
  {
    id: 'mobile-app',
    name: 'Mobile App',
    description: 'Prototype to store release for iOS/Android.',
    category: 'work',
    color: '#8b5cf6',
    stack: ['React Native', 'Expo', 'EAS'],
    tasks: [
      { title: 'Clickable prototype (3 screens)', priority: 'p1' },
      { title: 'Navigation + offline cache', priority: 'p1' },
      { title: 'Push notifications + icons', priority: 'p2' },
      { title: 'Beta track + store listing', priority: 'p2' },
    ],
    bestPractices: ['Test on a real device weekly', 'Screenshots before copy'],
    pitfalls: ['Ignoring store review lead times'],
    pro: true,
  },
  {
    id: 'marketing-site',
    name: 'Marketing Site',
    description: 'Landing page that converts: copy, proof, capture.',
    category: 'clients',
    color: '#f97316',
    stack: ['Astro', 'SEO basics', 'Analytics'],
    tasks: [
      { title: 'One-page copy draft', priority: 'p0' },
      { title: 'Hero + social proof sections', priority: 'p1' },
      { title: 'Email capture + analytics', priority: 'p1' },
      { title: 'SEO meta + sitemap + launch', priority: 'p2' },
    ],
    bestPractices: ['One call to action per page', 'Measure before redesigning'],
    pitfalls: ['Launching without analytics'],
    pro: false,
  },
  {
    id: 'writing-project',
    name: 'Writing Project',
    description: 'Articles, docs or a short ebook, start to published.',
    category: 'personal',
    color: '#22c55e',
    stack: ['Markdown', 'Hemingway', 'Grammarly'],
    tasks: [
      { title: 'Outline (headlines only)', priority: 'p0' },
      { title: 'Ugly first draft', priority: 'p1' },
      { title: 'Edit pass + examples', priority: 'p1' },
      { title: 'Publish + distribute', priority: 'p2' },
    ],
    bestPractices: ['Outline first, prose second', 'Ship the draft, then edit'],
    pitfalls: ['Editing while drafting'],
    pro: false,
  },
  {
    id: 'client-onboarding',
    name: 'Client Onboarding',
    description: 'Repeatable intake for a new freelance client.',
    category: 'clients',
    color: '#ec4899',
    stack: ['Contract', 'Invoice tool', 'Shared board'],
    tasks: [
      { title: 'Discovery call + written scope', priority: 'p0' },
      { title: 'Contract + deposit invoice', priority: 'p0' },
      { title: 'Access, repos, comms channels', priority: 'p1' },
      { title: 'Kickoff plan + milestones', priority: 'p1' },
    ],
    bestPractices: ['Scope in writing before work starts', 'Deposit before kickoff'],
    pitfalls: ['Starting work on a verbal agreement'],
    pro: true,
  },
  {
    id: 'diy-hardware',
    name: 'Hardware build',
    description: 'Plan, order parts, assemble, test, then first flight.',
    category: 'learning',
    color: '#14b8a6',
    stack: ['Parts list', 'Controller', 'Radio', 'Safety'],
    tasks: [
      { title: 'Define goals and limits', priority: 'p0' },
      { title: 'List and order parts', priority: 'p0' },
      { title: 'Assemble frame and power', priority: 'p1' },
      { title: 'Set up controller and radio', priority: 'p1' },
      { title: 'Run safe bench checks', priority: 'p1' },
      { title: 'First controlled hover and notes', priority: 'p2' },
    ],
    bestPractices: ['Set failsafe before motors spin', 'Finish bench checks before outdoor flight'],
    pitfalls: ['Skipping failsafe setup', 'Flying outdoors before a safe hover test'],
    pro: false,
  },
];

/** Blueprints visible to the caller (Free sees starters only). */
export function availableTemplates(isPro: boolean): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter((t) => isPro || !t.pro);
}

export function getTemplateById(id: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find((t) => t.id === id) ?? null;
}

export interface InstantiatedTemplate {
  project: Project;
  tasks: Task[];
}

/**
 * Build a project + starter tasks from a template.
 * Pure: persistence stays with the caller (saveProjects / saveTasks).
 */
export function instantiateTemplate(
  template: ProjectTemplate,
  projectName?: string,
): InstantiatedTemplate {
  const project = createProjectObject(projectName?.trim() || template.name, template.category);
  project.color = template.color;
  const tasks = template.tasks.map((t) => createTaskObject(project.id, t.title, t.priority));
  return { project, tasks };
}
