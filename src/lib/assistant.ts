/* Rule-based AI assistant (Roadmap Phase 4.1/4.3, zero API cost).
 *
 * A tiny intent engine over the existing product engines (Eisenhower,
 * frog picker, goals, history): quick answers, daily suggestions and
 * natural-language task creation ("add task X p0 tomorrow for Client").
 * Conversation history is capped and persisted locally.
 */
import { STORAGE_KEYS } from './storage/storageKeys';
import { safeRead as read, safeWrite as write } from './storage/storageAdapter';
import { dayKeyInTz, currentStreakInTz } from './timezone';
import { quadrantCounts, quadrantFocus } from './eisenhower';
import { pickFrog } from './frog';
import { goalForProject, goalProgress, rootGoals } from './goals';
import { peakHours } from './energy';
import { activeSprint } from './sprints';
import type { Task, TaskPriority } from './tasks';
import type { Project } from './projects';
import type { Goal } from './goals';
import type { Sprint } from './sprints';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

/** Conversation memory cap (oldest trimmed first). */
export const MAX_CHAT_MESSAGES = 50;

export type AssistantTone = 'concise' | 'encouraging' | 'direct';

export const ASSISTANT_TONES: AssistantTone[] = ['concise', 'encouraging', 'direct'];

export const TONE_LABELS: Record<AssistantTone, string> = {
  concise: 'Concise',
  encouraging: 'Encouraging',
  direct: 'Drill sergeant',
};

/** Never throws. Falls back to concise on junk. */
export function loadAssistantTone(): AssistantTone {
  const stored = read<string>(STORAGE_KEYS.assistantTone);
  return ASSISTANT_TONES.includes(stored as AssistantTone) ? (stored as AssistantTone) : 'concise';
}

export function saveAssistantTone(tone: AssistantTone): boolean {
  return write(STORAGE_KEYS.assistantTone, tone);
}

export function loadChatHistory(): ChatMessage[] {
  const stored = read<ChatMessage[]>(STORAGE_KEYS.chatHistory);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map((m) => ({
      id: typeof m.id === 'string' ? m.id : `${m.at ?? Date.now()}-${Math.random()}`,
      role: m.role,
      text: m.text.slice(0, 2000),
      at: typeof m.at === 'number' ? m.at : Date.now(),
    }))
    .slice(-MAX_CHAT_MESSAGES);
}

export function saveChatHistory(messages: ChatMessage[]): boolean {
  return write(STORAGE_KEYS.chatHistory, messages.slice(-MAX_CHAT_MESSAGES));
}

export function appendMessage(
  history: ChatMessage[],
  role: ChatMessage['role'],
  text: string,
): ChatMessage[] {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return history;
  return [
    ...history,
    {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      text: clean,
      at: Date.now(),
    },
  ].slice(-MAX_CHAT_MESSAGES);
}

/* ---------------- natural-language task creation ---------------- */

export interface ParsedTaskCommand {
  title: string;
  priority: TaskPriority;
  /** Epoch ms at local noon, when a due phrase was found. */
  dueAt: number | null;
  /** Raw project mention ("for X" / "in X"), resolved by the UI. */
  projectQuery: string | null;
}

const ADD_TRIGGERS = /^(please\s+)?(add|create|new|todo|remind me to)\b/i;

function noonPlusDays(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/**
 * Parse a whole natural-language date phrase ("next friday", "the 15th",
 * "next month") into a local-noon epoch ms. Broader vocabulary than the
 * inline tail-matcher in `parseTaskCommand` — used there as a fallback and
 * directly for reschedule commands. Never throws; unknown phrases → null.
 */
export function parseDuePhrase(phrase: string, now: number = Date.now()): number | null {
  const p = phrase
    .trim()
    .toLowerCase()
    .replace(/^on\s+/, '');
  if (p === 'today' || p === 'tonight') return noonPlusDays(now, 0);
  if (p === 'tomorrow') return noonPlusDays(now, 1);
  if (p === 'next week') return noonPlusDays(now, 7);
  if (p === 'next month') {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }
  const inDays = p.match(/^in\s+(\d{1,3})\s+days?$/);
  if (inDays) return noonPlusDays(now, Math.min(365, parseInt(inDays[1], 10)));
  const wd = p.match(/^(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1] as (typeof WEEKDAYS)[number]);
    const cur = new Date(now).getDay();
    let delta = (target - cur + 7) % 7;
    // A bare/"next" weekday always means the upcoming one, not today.
    if (delta === 0) delta = 7;
    return noonPlusDays(now, delta);
  }
  const nth = p.match(/^the\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (nth) {
    const day = parseInt(nth[1], 10);
    if (day < 1 || day > 31) return null;
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    if (d.getDate() >= day) d.setMonth(d.getMonth() + 1);
    d.setDate(day);
    return d.getTime();
  }
  return null;
}

/**
 * Parse "add task X p0 tomorrow for Client" into a structured command.
 * Returns null when the text is not a task-creation request. Never throws.
 */
export function parseTaskCommand(text: string, now: number = Date.now()): ParsedTaskCommand | null {
  const clean = text.trim();
  if (!ADD_TRIGGERS.test(clean)) return null;
  let rest = clean
    .replace(ADD_TRIGGERS, '')
    .trim()
    .replace(/^(a\s+)?(new\s+)?(task|todo|reminder)\s*:?\s*/i, '')
    .trim();
  if (!rest) return null;

  // Due phrases and project mentions both anchor at the tail ("X tomorrow
  // for Client"): extract iteratively until neither matches anymore.
  let dueAt: number | null = null;
  let projectQuery: string | null = null;
  for (let i = 0; i < 3; i++) {
    const dueMatch = rest.match(/\b(today|tonight|tomorrow|next week|in (\d{1,3}) days?)\s*$/i);
    if (dueMatch) {
      const phrase = dueMatch[1].toLowerCase();
      if (phrase === 'today' || phrase === 'tonight') dueAt = noonPlusDays(now, 0);
      else if (phrase === 'tomorrow') dueAt = noonPlusDays(now, 1);
      else if (phrase === 'next week') dueAt = noonPlusDays(now, 7);
      else if (dueMatch[2]) dueAt = noonPlusDays(now, Math.min(365, parseInt(dueMatch[2], 10)));
      rest = rest.slice(0, dueMatch.index).trim();
      continue;
    }
    // Broader date vocabulary (weekday names, "the Nth", "next month"),
    // tried only once the plain-phrase match above misses.
    const richDueMatch = rest.match(
      /\s+(?:on\s+)?((?:next\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|next month|the\s+\d{1,2}(?:st|nd|rd|th)?)\s*$/i,
    );
    if (richDueMatch && dueAt === null) {
      const parsedDue = parseDuePhrase(richDueMatch[1], now);
      if (parsedDue !== null) {
        dueAt = parsedDue;
        rest = rest.slice(0, richDueMatch.index).trim();
        continue;
      }
    }
    const projMatch = rest.match(/\s+(?:for|in)\s+([a-z0-9][a-z0-9 _-]*)\s*$/i);
    if (projMatch && projectQuery === null) {
      projectQuery = projMatch[1].trim();
      rest = rest.slice(0, projMatch.index).trim();
      continue;
    }
    break;
  }

  // Priority tokens or words (checked last so they bind to the title tail).
  let priority: TaskPriority = 'p2';
  const pMatch = rest.match(/\b(p[0-3])\b/i);
  if (pMatch) {
    priority = pMatch[1].toLowerCase() as TaskPriority;
    rest = rest.replace(pMatch[0], '').trim();
  } else if (/\b(urgent|asap|critical)\b/i.test(rest)) {
    priority = 'p0';
    rest = rest.replace(/\b(urgent|asap|critical)\b/i, '').trim();
  } else if (/\b(important)\b/i.test(rest)) {
    priority = 'p1';
    rest = rest.replace(/\b(important)\b/i, '').trim();
  } else if (/\b(low|someday|minor)\b/i.test(rest)) {
    priority = 'p3';
    rest = rest.replace(/\b(low|someday|minor)\b/i, '').trim();
  }

  const title = rest
    .replace(/\s+/g, ' ')
    .replace(/[.!.?]+$/, '')
    .trim();
  if (!title) return null;
  return { title, priority, dueAt, projectQuery };
}

/* ---------------- responder ---------------- */

export interface AssistantContext {
  tasks: Task[];
  projects: Project[];
  history: Array<{ at: number; min: number; taskId?: string }>;
  timezone: string;
  goals: Goal[];
  energyLog?: Array<{ at: number; level: number }>;
  /** Same data the Command Center surfaces (Faza 31) — makes suggestions contextual, not generic. */
  sprints?: Sprint[];
  selectedProjectId?: string | null;
}

export type AssistantAction =
  | {
      type: 'add-task';
      title: string;
      priority: TaskPriority;
      dueAt: number | null;
      projectQuery: string | null;
    }
  | { type: 'build-plan'; items: string[] }
  | { type: 'complete-task'; taskId: string }
  | { type: 'delete-task'; taskId: string }
  | { type: 'reschedule-task'; taskId: string; dueAt: number }
  | { type: 'reprioritize-task'; taskId: string; priority: TaskPriority }
  | null;

export interface AssistantReply {
  text: string;
  action: AssistantAction;
  /** Task now "in focus" for follow-ups like "make it p0" — caller persists this. */
  contextTaskId?: string;
}

/** Resolve "it"/"that one" against the last-referenced task, else fuzzy title match. */
function resolveTaskRef(
  ref: string,
  tasks: Task[],
  focusTaskId?: string,
): { task: Task | null; ambiguous: Task[] } {
  const clean = ref
    .trim()
    .toLowerCase()
    .replace(/^(the|task)\s+/, '');
  const open = tasks.filter((x) => x.status !== 'completed');
  if (/^(it|that|that one|this|this one)$/.test(clean)) {
    const found = focusTaskId ? open.find((x) => x.id === focusTaskId) : undefined;
    return { task: found ?? null, ambiguous: [] };
  }
  const matches = open.filter((x) => x.title.toLowerCase().includes(clean));
  if (matches.length === 1) return { task: matches[0], ambiguous: [] };
  if (matches.length > 1) return { task: null, ambiguous: matches };
  return { task: null, ambiguous: [] };
}

function priorityFromToken(token: string): TaskPriority {
  const t = token.toLowerCase();
  if (t === 'urgent') return 'p0';
  if (t === 'important') return 'p1';
  if (t === 'low') return 'p3';
  return t as TaskPriority;
}

export interface QuickAction {
  label: string;
  message: string;
  pro: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'What should I work on?', message: 'What should I work on?', pro: false },
  { label: 'Pick my frog', message: 'Pick my frog', pro: false },
  { label: 'Plan my day', message: 'Plan my day', pro: true },
  { label: 'My progress today', message: 'How am I doing today?', pro: true },
  { label: 'Review my goals', message: 'Review my goals', pro: true },
  { label: 'Add a task…', message: 'Add task ', pro: true },
];

function todayMinutes(history: AssistantContext['history'], timezone: string): number {
  const key = dayKeyInTz(Date.now(), timezone);
  return history
    .filter((s) => dayKeyInTz(s.at, timezone) === key)
    .reduce((sum, s) => sum + (typeof s.min === 'number' ? s.min : 0), 0);
}

/**
 * Morning motivation line from streak + today (Roadmap 4.4/6.2, rule-based).
 * Never throws.
 */
export function motivationLine(
  history: AssistantContext['history'],
  timezone: string,
  tone: AssistantTone = 'concise',
): string {
  const streak = currentStreakInTz(history, timezone);
  const min = todayMinutes(history, timezone);
  let base: string;
  if (streak >= 7) base = `${streak}-day streak — you're undeniable. Protect it with one round.`;
  else if (streak >= 3) base = `${streak} days in a row — momentum is real. Keep it alive.`;
  else if (min > 0) base = `${min}m already today — good start. One more round?`;
  else base = 'Fresh page. One 25-minute round and the day is already a win.';
  if (tone === 'encouraging') return `${base} I believe in you — go get it. 💪`;
  if (tone === 'direct') return `${base} No excuses. Timer on.`;
  return base;
}

/** Rule-based reply. Pure except Date.now for "today" math. Never throws. */
export function respondTo(
  input: string,
  ctx: AssistantContext,
  tone: AssistantTone = 'concise',
  focusTaskId?: string,
): AssistantReply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const now = Date.now();

  const parsed = parseTaskCommand(text, now);
  if (parsed) {
    const where = parsed.projectQuery ? ` for ${parsed.projectQuery}` : '';
    const when =
      parsed.dueAt !== null
        ? `, due ${new Date(parsed.dueAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
        : '';
    return {
      text: `On it — creating “${parsed.title}” (${parsed.priority.toUpperCase()}${when})${where}.`,
      action: { type: 'add-task', ...parsed },
    };
  }

  const ambiguousReply = (ambiguous: Task[]): AssistantReply => ({
    text: `I found a few matches — which one? ${ambiguous
      .slice(0, 3)
      .map((x) => `“${x.title}”`)
      .join(', ')}.`,
    action: null,
  });
  const notFoundReply = (ref: string): AssistantReply => ({
    text: `Couldn't find an open task matching “${ref}”.`,
    action: null,
  });

  const completeMatch =
    text.match(/^mark\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)$/i) ??
    text.match(/^(?:complete|finish)\s+(.+)$/i);
  if (completeMatch) {
    const { task, ambiguous } = resolveTaskRef(completeMatch[1], ctx.tasks, focusTaskId);
    if (ambiguous.length > 0) return ambiguousReply(ambiguous);
    if (!task) return notFoundReply(completeMatch[1]);
    return {
      text: `Done — “${task.title}” marked complete. 🎉`,
      action: { type: 'complete-task', taskId: task.id },
      contextTaskId: task.id,
    };
  }

  const deleteMatch = text.match(/^(?:delete|remove|drop)\s+(?:the\s+)?(?:task\s+)?(.+)$/i);
  if (deleteMatch) {
    const { task, ambiguous } = resolveTaskRef(deleteMatch[1], ctx.tasks, focusTaskId);
    if (ambiguous.length > 0) return ambiguousReply(ambiguous);
    if (!task) return notFoundReply(deleteMatch[1]);
    return {
      text: `Deleted “${task.title}”.`,
      action: { type: 'delete-task', taskId: task.id },
    };
  }

  const rescheduleMatch = text.match(/^(?:reschedule|move|push|postpone)\s+(.+?)\s+to\s+(.+)$/i);
  if (rescheduleMatch) {
    const { task, ambiguous } = resolveTaskRef(rescheduleMatch[1], ctx.tasks, focusTaskId);
    if (ambiguous.length > 0) return ambiguousReply(ambiguous);
    if (!task) return notFoundReply(rescheduleMatch[1]);
    const dueAt = parseDuePhrase(rescheduleMatch[2], now);
    if (dueAt === null) {
      return {
        text: `Not sure when “${rescheduleMatch[2]}” is — try a date like “friday”.`,
        action: null,
      };
    }
    return {
      text: `Moved “${task.title}” to ${new Date(dueAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`,
      action: { type: 'reschedule-task', taskId: task.id, dueAt },
      contextTaskId: task.id,
    };
  }

  const priorityMatch = text.match(
    /^(?:make|set)\s+(.+?)\s+(?:priority\s+)?(?:to\s+)?(p[0-3]|urgent|important|low)$/i,
  );
  if (priorityMatch) {
    const { task, ambiguous } = resolveTaskRef(priorityMatch[1], ctx.tasks, focusTaskId);
    if (ambiguous.length > 0) return ambiguousReply(ambiguous);
    if (!task) return notFoundReply(priorityMatch[1]);
    const priority = priorityFromToken(priorityMatch[2]);
    return {
      text: `“${task.title}” is now ${priority.toUpperCase()}.`,
      action: { type: 'reprioritize-task', taskId: task.id, priority },
      contextTaskId: task.id,
    };
  }

  if (/^(hi|hello|hey|help|what can you do|capabilities)\b/.test(lower)) {
    return {
      text: 'I can prioritize your day (“what should I work on?”), pick your frog, review goals and progress, create tasks (“add task Draft proposal p1 tomorrow”), or modify them — “complete X”, “delete X”, “reschedule X to friday”, “make X p0”.',
      action: null,
    };
  }

  const frog = pickFrog(ctx.tasks, ctx.projects, now);

  if (/plan my day|build.*plan|schedule (my day|today)/.test(lower)) {
    const items: string[] = [];
    if (frog) items.push(`🐸 ${frog.title}`);
    const focus = quadrantFocus(ctx.tasks, now);
    if (focus.task && focus.task.title !== frog?.title) items.push(focus.task.title);
    const openGoal = rootGoals(ctx.goals).find(
      (g) => !g.archived && goalProgress(ctx.goals, ctx.tasks, g.id) < 100,
    );
    if (openGoal && items.length < 3) items.push(`🎯 ${openGoal.title}`);
    if (items.length === 0) {
      return { text: 'Nothing open — enjoy the clear board, or add a task first.', action: null };
    }
    const peaks = ctx.energyLog ? peakHours(ctx.energyLog, now, 1) : [];
    const peakLine =
      peaks.length > 0 ? ` Peak energy ≈ ${peaks[0].hour}:00 — do the frog then.` : '';
    const sprint =
      ctx.sprints && ctx.selectedProjectId
        ? activeSprint(ctx.sprints, ctx.selectedProjectId)
        : null;
    const sprintLine = sprint
      ? ` Sprint “${sprint.name}” ends ${new Date(sprint.endAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}.`
      : '';
    return {
      text: `Today's plan: ${items.join(' → ')}.${peakLine}${sprintLine} Writing it into your Ivy Lee list now.`,
      action: { type: 'build-plan', items },
    };
  }

  if (/frog/.test(lower)) {
    if (!frog)
      return { text: 'No frogs left — every task is done. Enjoy the clear pond.', action: null };
    return {
      text: `Today's frog: “${frog.title}” (${frog.priority.toUpperCase()}). Eat it first — everything after feels easy.`,
      action: null,
    };
  }

  if (/work on|next|should i|prioriti|focus/.test(lower)) {
    const focus = quadrantFocus(ctx.tasks, now);
    if (!focus.task) return { text: focus.headline, action: null };
    const goal = goalForProject(ctx.goals, focus.task.projectId);
    const goalLine = goal ? ` Part of “${goal.title}”.` : '';
    return {
      text: `${focus.headline} Top pick: “${focus.task.title}”.${goalLine}`,
      action: null,
    };
  }

  if (/matrix|eisenhower|quadrant|urgent/.test(lower)) {
    const c = quadrantCounts(ctx.tasks, now);
    const total = c.q1 + c.q2 + c.q3 + c.q4;
    if (total === 0)
      return { text: 'Your matrix is empty — add tasks to projects first.', action: null };
    return {
      text: `Matrix: ${c.q1} do-first, ${c.q2} to schedule, ${c.q3} to delegate, ${c.q4} to eliminate. ${
        c.q1 > 0
          ? 'Clear Q1 before anything else.'
          : c.q2 > 0
            ? 'No fires — protect time for Q2 deep work.'
            : 'Nothing urgent — prune Q4.'
      }`,
      action: null,
    };
  }

  if (/goal/.test(lower)) {
    const roots = rootGoals(ctx.goals);
    if (roots.length === 0)
      return { text: 'No goals yet — create a vision and break it into milestones.', action: null };
    const lines = roots
      .slice(0, 3)
      .map((g) => `“${g.title}” ${goalProgress(ctx.goals, ctx.tasks, g.id)}%`);
    return { text: `Goals: ${lines.join(' · ')}.`, action: null };
  }

  if (/progress|report|summar|how am i|stats|streak|doing/.test(lower)) {
    const min = todayMinutes(ctx.history, ctx.timezone);
    const sessions = ctx.history.filter(
      (s) => dayKeyInTz(s.at, ctx.timezone) === dayKeyInTz(now, ctx.timezone),
    ).length;
    const streak = currentStreakInTz(ctx.history, ctx.timezone);
    return {
      text: `Today: ${sessions} session${sessions === 1 ? '' : 's'}, ${min} focused minutes, ${streak}-day streak. ${
        min >= 100 ? 'Strong day — protect the streak.' : 'Room to grow — one more 25-minute round?'
      }`,
      action: null,
    };
  }

  return {
    text:
      tone === 'direct'
        ? 'Unclear. Say “what should I work on?”, “pick my frog”, or “add task …”. Now.'
        : tone === 'encouraging'
          ? 'Hmm, not sure I got that — but I believe in you! Try “what should I work on?”, “pick my frog”, or create with “add task …”. 💪'
          : 'I can prioritize (“what should I work on?”), pick your frog, review goals or progress — or create a task with “add task …”.',
    action: null,
  };
}
