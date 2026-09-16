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
import { goalProgress, rootGoals } from './goals';
import type { Task, TaskPriority } from './tasks';
import type { Project } from './projects';
import type { Goal } from './goals';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

/** Conversation memory cap (oldest trimmed first). */
export const MAX_CHAT_MESSAGES = 50;

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
}

export type AssistantAction = {
  type: 'add-task';
  title: string;
  priority: TaskPriority;
  dueAt: number | null;
  projectQuery: string | null;
} | null;

export interface AssistantReply {
  text: string;
  action: AssistantAction;
}

export interface QuickAction {
  label: string;
  message: string;
  pro: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'What should I work on?', message: 'What should I work on?', pro: false },
  { label: 'Pick my frog', message: 'Pick my frog', pro: false },
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

/** Rule-based reply. Pure except Date.now for "today" math. Never throws. */
export function respondTo(input: string, ctx: AssistantContext): AssistantReply {
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

  if (/^(hi|hello|hey|help|what can you do|capabilities)\b/.test(lower)) {
    return {
      text: 'I can prioritize your day (“what should I work on?”), pick your frog, review goals and progress, or create tasks — try “add task Draft proposal p1 tomorrow”.',
      action: null,
    };
  }

  if (/frog/.test(lower)) {
    const frog = pickFrog(ctx.tasks, ctx.projects, now);
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
    return {
      text: `${focus.headline} Top pick: “${focus.task.title}”.`,
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
    text: 'I can prioritize (“what should I work on?”), pick your frog, review goals or progress — or create a task with “add task …”.',
    action: null,
  };
}
