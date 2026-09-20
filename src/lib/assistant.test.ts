import { describe, expect, it } from 'vitest';

import {
  MAX_CHAT_MESSAGES,
  QUICK_ACTIONS,
  appendMessage,
  loadAssistantTone,
  loadChatHistory,
  motivationLine,
  parseTaskCommand,
  respondTo,
  saveAssistantTone,
  saveChatHistory,
  type AssistantContext,
} from './assistant';
import type { Project } from './projects';
import type { Task } from './tasks';

const NOW = new Date(2026, 8, 16, 12, 0).getTime();

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 't1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Task',
    status: overrides.status ?? 'pending',
    priority: overrides.priority ?? 'p1',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Client',
    color: '#fff',
    category: 'work',
    tags: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AssistantContext> = {}): AssistantContext {
  return {
    tasks: [],
    projects: [makeProject()],
    history: [],
    timezone: 'UTC',
    goals: [],
    ...overrides,
  };
}

describe('parseTaskCommand', () => {
  it('parses title, priority, due and project', () => {
    const cmd = parseTaskCommand('Add task Draft proposal p1 tomorrow for Client', NOW)!;
    expect(cmd.title).toBe('Draft proposal');
    expect(cmd.priority).toBe('p1');
    expect(cmd.projectQuery).toBe('Client');
    expect(cmd.dueAt).not.toBeNull();
    const due = new Date(cmd.dueAt!);
    expect(due.getDate()).toBe(17);
  });

  it('understands priority words and relative due phrases', () => {
    const urgent = parseTaskCommand('create urgent fix login', NOW)!;
    expect(urgent.priority).toBe('p0');
    expect(urgent.title).toBe('fix login');
    const week = parseTaskCommand('add review docs next week', NOW)!;
    expect(new Date(week.dueAt!).getDate()).toBe(23);
    const days = parseTaskCommand('todo file taxes in 3 days', NOW)!;
    expect(new Date(days.dueAt!).getDate()).toBe(19);
  });

  it('defaults sensibly and rejects non-commands', () => {
    const plain = parseTaskCommand('add buy milk', NOW)!;
    expect(plain.title).toBe('buy milk');
    expect(plain.priority).toBe('p2');
    expect(plain.dueAt).toBeNull();
    expect(plain.projectQuery).toBeNull();
    expect(parseTaskCommand('What should I work on?', NOW)).toBeNull();
    expect(parseTaskCommand('add   ', NOW)).toBeNull();
  });
});

describe('respondTo', () => {
  it('confirms task creation with an add-task action', () => {
    const reply = respondTo('add task Ship it p0', makeCtx());
    expect(reply.action).not.toBeNull();
    expect(reply.action!.type).toBe('add-task');
    if (reply.action?.type === 'add-task') {
      expect(reply.action.title).toBe('Ship it');
      expect(reply.action.priority).toBe('p0');
    }
    expect(reply.text).toContain('Ship it');
  });

  it('answers help, frog, focus and matrix intents', () => {
    const ctx = makeCtx({
      tasks: [makeTask({ id: 'a', title: 'Hard thing', priority: 'p0' })],
    });
    expect(respondTo('help', ctx).text).toContain('frog');
    expect(respondTo('pick my frog', ctx).text).toContain('Hard thing');
    expect(respondTo('what should I work on?', ctx).text).toContain('Hard thing');
    expect(respondTo('show my matrix', ctx).text).toContain('do-first');
  });

  it('reports goals and daily progress', () => {
    const at = Date.now();
    const ctx = makeCtx({
      history: [{ at, min: 25 }],
      goals: [
        {
          id: 'g1',
          title: 'Launch',
          level: 'vision',
          progress: 40,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(respondTo('review my goals', ctx).text).toContain('40%');
    const progress = respondTo('how am I doing today?', ctx).text;
    expect(progress).toContain('1 session');
    expect(progress).toContain('25 focused minutes');
  });

  it('falls back with guidance', () => {
    expect(respondTo('blargh wibble', makeCtx()).action).toBeNull();
    expect(respondTo('blargh wibble', makeCtx()).text).toContain('add task');
  });
});

describe('chat history', () => {
  it('caps at MAX_CHAT_MESSAGES and round-trips', () => {
    expect(MAX_CHAT_MESSAGES).toBe(50);
    expect(loadChatHistory()).toEqual([]);
    let log = appendMessage([], 'user', '  hello  ');
    expect(log).toHaveLength(1);
    expect(log[0].text).toBe('hello');
    expect(appendMessage(log, 'user', '   ')).toBe(log);
    for (let i = 0; i < MAX_CHAT_MESSAGES + 10; i++) {
      log = appendMessage(log, 'user', `m${i}`);
    }
    expect(log).toHaveLength(MAX_CHAT_MESSAGES);
    expect(saveChatHistory(log)).toBe(true);
    expect(loadChatHistory()).toHaveLength(MAX_CHAT_MESSAGES);
  });

  it('exposes quick actions with a free tier', () => {
    expect(QUICK_ACTIONS.length).toBeGreaterThanOrEqual(4);
    expect(QUICK_ACTIONS.filter((q) => !q.pro).length).toBeGreaterThanOrEqual(2);
  });
});

describe('tone + motivation', () => {
  it('persists the personality with a concise fallback', () => {
    expect(loadAssistantTone()).toBe('concise');
    expect(saveAssistantTone('direct')).toBe(true);
    expect(loadAssistantTone()).toBe('direct');
    expect(saveAssistantTone('concise')).toBe(true);
  });

  it('flavors the fallback per tone', () => {
    const ctx = makeCtx();
    expect(respondTo('blargh', ctx, 'direct').text).toContain('Now.');
    expect(respondTo('blargh', ctx, 'encouraging').text).toContain('💪');
    expect(respondTo('blargh', ctx).action).toBeNull();
  });

  it('motivates from streak and today', () => {
    const at = Date.now();
    expect(motivationLine([], 'UTC')).toContain('Fresh page');
    expect(motivationLine([{ at, min: 30 }], 'UTC', 'direct')).toContain('No excuses');
    expect(motivationLine([{ at, min: 30 }], 'UTC', 'encouraging')).toContain('💪');
  });

  it('builds a day plan from frog, focus and goals', () => {
    const ctx = makeCtx({
      tasks: [makeTask({ id: 'a', title: 'Hard thing', priority: 'p0' })],
      goals: [
        {
          id: 'g1',
          title: 'Launch',
          level: 'vision' as const,
          progress: 10,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const reply = respondTo('plan my day', ctx);
    expect(reply.action).not.toBeNull();
    expect(reply.action!.type).toBe('build-plan');
    if (reply.action?.type === 'build-plan') {
      expect(reply.action.items.join(' ')).toContain('Hard thing');
      expect(reply.action.items.join(' ')).toContain('Launch');
    }
  });

  it('schedules around measured energy peaks', () => {
    const at = Date.now();
    const d = new Date(at);
    d.setHours(9, 0, 0, 0);
    const peak = d.getTime() > at ? d.getTime() - 24 * 3600_000 : d.getTime();
    const ctx = makeCtx({
      tasks: [makeTask({ title: 'Work' })],
      energyLog: [
        { at: peak, level: 9 },
        { at: peak - 24 * 3600_000, level: 8 },
      ],
    });
    const reply = respondTo('plan my day', ctx);
    expect(reply.text).toContain('Peak energy');
  });
});
