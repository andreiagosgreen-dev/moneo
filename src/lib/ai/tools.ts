/**
 * Scoped AI tool schemas + prompt-injection guard (Faza 6, Faza 5A).
 *
 * The toolset is deliberately mutation-free: read tools observe, draft
 * tools propose, and NOTHING deletes, moves or commits. There is no
 * delete/move/commit tool to hijack — injection resistance by
 * construction, verified by test.
 *
 * User content (task/project titles, goal text) is always wrapped as
 * <user-data> and length-capped before it reaches any model context.
 * `flagInjection` exists for audit trails: it reports override attempts
 * found in user text without ever acting on them.
 */

export interface ToolArg {
  name: string;
  required: boolean;
  description: string;
}

export interface ToolSchema {
  name: string;
  kind: 'read' | 'draft' | 'explain';
  description: string;
  args: ToolArg[];
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'read_goals',
    kind: 'read',
    description: 'List the user goals (titles + progress only, no session contents).',
    args: [],
  },
  {
    name: 'read_projects',
    kind: 'read',
    description: 'List projects with open task counts (titles only).',
    args: [],
  },
  {
    name: 'create_task_draft',
    kind: 'draft',
    description: 'Propose up to 20 tasks for approval. Creates nothing.',
    args: [
      { name: 'tasks', required: true, description: 'Array of {title, pomodoros 1-8}.' },
      { name: 'milestone', required: false, description: 'Milestone the tasks belong to.' },
    ],
  },
  {
    name: 'create_plan_draft',
    kind: 'draft',
    description: 'Propose a 7-day plan draft within daily capacity. Creates nothing.',
    args: [{ name: 'days', required: true, description: 'Array of {dateKey, taskTitles[]}.' }],
  },
  {
    name: 'schedule_draft',
    kind: 'draft',
    description: 'Propose time blocks for approved tasks. Creates nothing.',
    args: [
      { name: 'items', required: true, description: 'Array of {weekday 0-6, startMin, endMin}.' },
    ],
  },
  {
    name: 'explain_recommendation',
    kind: 'explain',
    description: 'Explain why a recommendation helps, with the data used.',
    args: [{ name: 'recommendationId', required: true, description: 'Draft or task id.' }],
  },
];

const MAX_DATA_CHARS = 500;

/** Fence user content as data before it enters any model context. */
export function wrapAsData(text: unknown): string {
  const clean = typeof text === 'string' ? text : '';
  // Stripping control characters IS the job here.
  // eslint-disable-next-line no-control-regex
  const clipped = clean.replace(/[\0-\b\v\f\x0e-\x1f\x7f]/g, '').slice(0, MAX_DATA_CHARS);
  return `<user-data>${clipped}</user-data>`;
}

const INJECTION_PATTERNS: Array<{ id: string; re: RegExp }> = [
  {
    id: 'override',
    re: /ignore\s+(all\s+|any\s+)?(previous|prior|earlier|above)\s+instructions?/i,
  },
  { id: 'disregard', re: /disregard\s+.*instructions?/i },
  { id: 'system-role', re: /(^|[\s>])system\s*:/i },
  { id: 'jailbreak', re: /jailbreak|dan\s+mode|developer\s+mode/i },
  {
    id: 'exfiltrate',
    re: /reveal\s+(your|the)\s+(prompt|instructions|system)|dump\s+.*(context|memory)/i,
  },
  {
    id: 'destructive',
    re: /delete\s+(all|everything)|drop\s+table|wipe\s+.*data|forget\s+everything/i,
  },
  { id: 'role-claim', re: /you\s+are\s+now\s+(an?\s+)?(admin|root|system|developer)/i },
];

/**
 * Report override-attempt patterns found in user text (ids, for audit).
 * Detection never blocks and never executes — the planner treats all
 * user text as inert data regardless of the result.
 */
export function flagInjection(text: unknown): string[] {
  if (typeof text !== 'string' || !text) return [];
  const hits: string[] = [];
  for (const { id, re } of INJECTION_PATTERNS) {
    if (re.test(text) && !hits.includes(id)) hits.push(id);
  }
  return hits;
}

export interface DraftTaskInput {
  title: unknown;
  pomodoros: unknown;
}

/**
 * Validate a task draft before preview: bounded count, sane titles and
 * Pomodoro estimates. The approve path refuses invalid drafts outright.
 */
export function validateDraft(tasks: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(tasks)) return { ok: false, errors: ['not-an-array'] };
  if (tasks.length === 0) errors.push('empty');
  if (tasks.length > 20) errors.push('too-many');
  tasks.forEach((t, i) => {
    const rec = (t ?? {}) as Partial<Record<'title' | 'pomodoros', unknown>>;
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    if (!title) errors.push(`task-${i}-no-title`);
    else if (title.length > 120) errors.push(`task-${i}-title-too-long`);
    const p = typeof rec.pomodoros === 'number' ? rec.pomodoros : NaN;
    if (!Number.isInteger(p) || p < 1 || p > 8) errors.push(`task-${i}-bad-estimate`);
  });
  return { ok: errors.length === 0, errors };
}
