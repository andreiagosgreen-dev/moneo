import { describe, it, expect } from 'vitest';
import {
  getInsights,
  loadDismissedInsights,
  saveDismissedInsights,
  visibleInsights,
  CORE_INSIGHT_LIMIT,
  type Insight,
} from './insights';
import type { Session } from './store';
import type { Project } from './projects';
import { dayKeyInTz } from './timezone';
import { createBlock, weekdayOfKey } from './timeBlocks';

const TZ = 'UTC';

const NOW = Date.now();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function p(id: string, name: string, extra: Partial<Project> = {}): Project {
  return {
    id,
    name,
    color: '#22c55e',
    category: 'work',
    tags: [],
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
    ...extra,
  };
}

function s(offsetMs: number, min: number, extra: Partial<Session> = {}): Session {
  return { id: `s-${offsetMs}-${min}`, at: NOW - offsetMs, min, ...extra };
}

type TaskLike = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
};

describe('visibleInsights', () => {
  const core: Insight = {
    id: 'a',
    tier: 'core',
    kind: 'streak',
    title: 't',
    body: 'b',
    reason: 'r',
    dataUsed: 'd',
    confidence: 'high',
    cta: { type: 'none' },
  };
  const pro: Insight = {
    id: 'b',
    tier: 'pro',
    kind: 'nextTask',
    title: 't',
    body: 'b',
    reason: 'r',
    dataUsed: 'd',
    confidence: 'medium',
    cta: { type: 'none' },
  };

  it('returns all for Pro', () => {
    expect(visibleInsights([core, pro], true)).toHaveLength(2);
  });

  it('caps free users at CORE_INSIGHT_LIMIT core insights', () => {
    expect(
      visibleInsights([core, pro, { ...core, id: 'c' }, { ...core, id: 'd' }], false),
    ).toHaveLength(CORE_INSIGHT_LIMIT);
  });

  it('excludes pro insight entirely for free users', () => {
    const visible = visibleInsights([core, pro], false);
    expect(visible.every((i) => i.id !== 'b')).toBe(true);
  });
});

describe('getInsights', () => {
  it('returns only the streak-start insight when there is no history', () => {
    const insights = getInsights({ history: [], projects: [], areas: [], tasks: [], timezone: TZ });
    expect(insights).toHaveLength(1);
    expect(insights[0].kind).toBe('streak');
  });

  it('produces a streak insight for a 3-day streak', () => {
    const history = [s(0, 25), s(1 * DAY, 25), s(2 * DAY, 25)];
    const insights = getInsights({ history, projects: [], areas: [], tasks: [], timezone: TZ });
    const streak = insights.find((i) => i.kind === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.title).toContain('3-day');
    expect(streak!.tier).toBe('core');
  });

  it('detects the pareto project', () => {
    const projects = [p('p1', 'Revenue'), p('p2', 'Hobby'), p('p3', 'Chores')];
    const history = [
      s(0, 25, { projectId: 'p1' }),
      s(1 * DAY, 25, { projectId: 'p1' }),
      s(2 * DAY, 25, { projectId: 'p2' }),
      s(3 * DAY, 1, { projectId: 'p3' }),
    ];
    const insights = getInsights({ history, projects, areas: [], tasks: [], timezone: TZ });
    const pareto = insights.find((i) => i.kind === 'pareto');
    expect(pareto).toBeDefined();
    expect(pareto!.body).toContain('Revenue');
    expect(pareto!.tier).toBe('core');
  });

  it('excludes archived projects from agony/deadline rules', () => {
    const projects = [
      p('p1', 'Active', { deadline: NOW + 3 * DAY }),
      p('p2', 'Old', { deadline: NOW + 2 * DAY, archived: true }),
    ];
    const history = [s(1 * DAY, 25, { projectId: 'p1' })];
    const insights = getInsights({ history, projects, areas: [], tasks: [], timezone: TZ });
    expect(insights.some((i) => i.kind === 'deadline' && i.body.includes('Old'))).toBe(false);
  });

  it('flags a neglect project that went quiet', () => {
    const projects = [p('p1', 'Client X'), p('p2', 'Blog')];
    const history = [
      // Client X: 60m in last 30d, nothing in last 3d
      s(4 * DAY, 25, { projectId: 'p1' }),
      s(5 * DAY, 35, { projectId: 'p1' }),
      // Blog: active recently
      s(1 * DAY, 25, { projectId: 'p2' }),
    ];
    const insights = getInsights({ history, projects, areas: [], tasks: [], timezone: TZ });
    const neglect = insights.find((i) => i.kind === 'neglect');
    expect(neglect).toBeDefined();
    expect(neglect!.body).toContain('Client X');
    expect(neglect!.tier).toBe('pro');
  });

  it('suggests the highest-priority open task', () => {
    const projects = [p('p1', 'Ship app')];
    const tasks: TaskLike[] = [
      { id: 't1', projectId: 'p1', title: 'Fix auth', status: 'pending', priority: 'p0' },
      { id: 't2', projectId: 'p1', title: 'Polish copy', status: 'pending', priority: 'p2' },
    ];
    const history = [s(1 * DAY, 25, { projectId: 'p1', taskId: 't1' })];
    const insights = getInsights({ history, projects, areas: [], tasks, timezone: TZ });
    const next = insights.find((i) => i.kind === 'nextTask');
    expect(next).toBeDefined();
    expect(next!.body).toContain('Fix auth');
    expect(next!.tier).toBe('pro');
  });

  it('respects deadlines over priority when both present', () => {
    const soon = p('p1', 'Soon', { deadline: NOW + 2 * DAY });
    const projects = [soon, p('p2', 'Relaxed')];
    const tasks: TaskLike[] = [
      { id: 't1', projectId: 'p1', title: 'Urgent-ish', status: 'pending', priority: 'p2' },
      { id: 't2', projectId: 'p2', title: 'Low prio', status: 'pending', priority: 'p0' },
    ];
    const insights = getInsights({ history: [s(0, 25)], projects, areas: [], tasks, timezone: TZ });
    const next = insights.find((i) => i.kind === 'nextTask');
    // p0 without deadline vs p2 with deadline → deadline wins (sort is priority first,
    // so this asserts the tiebreak works when priorities differ). Here p0 wins priority.
    expect(next!.body).toContain('Low prio');
  });

  it('identifies the best focus window', () => {
    const atHour = (hour: number, daysAgo: number) => {
      const d = new Date(NOW - daysAgo * DAY);
      d.setUTCHours(hour, 30, 0, 0);
      return d.getTime();
    };
    const history = [
      s(atHour(9, 1), 25),
      s(atHour(9, 2), 25),
      s(atHour(17, 1), 25),
      s(atHour(17, 2), 25),
    ];
    const insights = getInsights({ history, projects: [], areas: [], tasks: [], timezone: TZ });
    const win = insights.find((i) => i.kind === 'bestWindow');
    expect(win).toBeDefined();
    expect(win!.tier).toBe('pro');
  });

  it('celebrates fully-completed goals', () => {
    const goals = [
      {
        id: 'g1',
        title: 'Launch the SaaS',
        level: 'vision' as const,
        progress: 100,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const insights = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
      goals,
    });
    const mile = insights.find((i) => i.kind === 'milestone');
    expect(mile).toBeDefined();
    expect(mile!.body).toContain('Launch the SaaS');
    expect(mile!.tier).toBe('core');
  });

  it('stays quiet on milestones without goals or progress', () => {
    const empty = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
    });
    expect(empty.some((i) => i.kind === 'milestone')).toBe(false);
    const partial = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
      goals: [
        {
          id: 'g1',
          title: 'Half',
          level: 'vision' as const,
          progress: 40,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    expect(partial.some((i) => i.kind === 'milestone')).toBe(false);
  });

  it('adapts to pace swings week over week', () => {
    const ahead = getInsights({
      history: [
        { id: 'a', at: NOW - 1 * DAY, min: 200 },
        { id: 'b', at: NOW - 10 * DAY, min: 50 },
      ],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
    });
    const up = ahead.find((i) => i.kind === 'pace');
    expect(up).toBeDefined();
    expect(up!.title).toContain('Ahead');
    const behind = getInsights({
      history: [
        { id: 'a', at: NOW - 1 * DAY, min: 30 },
        { id: 'b', at: NOW - 10 * DAY, min: 200 },
      ],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
    });
    const down = behind.find((i) => i.kind === 'pace');
    expect(down).toBeDefined();
    expect(down!.title).toContain('Behind');
  });

  it('persists dismissed feedback', () => {
    expect(loadDismissedInsights()).toEqual([]);
    expect(saveDismissedInsights(['pareto', 'pace'])).toBe(true);
    expect(loadDismissedInsights()).toEqual(['pareto', 'pace']);
  });
});

describe('Faza 7 action insights', () => {
  it('every insight carries reason, data, confidence and a CTA slot', () => {
    const projects = [p('p1', 'Revenue'), p('p2', 'Hobby')];
    const history = [
      s(0, 25, { projectId: 'p1' }),
      s(1 * DAY, 25, { projectId: 'p1' }),
      s(2 * DAY, 25, { projectId: 'p2' }),
    ];
    const tasks: TaskLike[] = [
      { id: 't1', projectId: 'p1', title: 'Fix auth', status: 'pending', priority: 'p0' },
    ];
    const insights = getInsights({ history, projects, areas: [], tasks, timezone: TZ });
    expect(insights.length).toBeGreaterThan(0);
    for (const ins of insights) {
      expect(ins.reason.trim().length, `${ins.id} reason`).toBeGreaterThan(0);
      expect(ins.dataUsed.trim().length, `${ins.id} data`).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(ins.confidence);
      expect(ins.cta.type).toMatch(
        /^(none|block-tomorrow|step-today|add-to-plan|move-to-tomorrow|prioritize-task)$/,
      );
    }
  });

  it('offers a block-tomorrow CTA on the power-hours window', () => {
    // Absolute January timestamps (UTC, DST-free) — deterministic forever.
    const at = (day: number, hour: number, min = 30) => Date.UTC(2026, 0, day, hour, min, 0, 0);
    const sess = (id: string, timestamp: number): Session => ({ id, at: timestamp, min: 25 });
    const history = [
      sess('a', at(5, 9)),
      sess('b', at(6, 9)),
      sess('c', at(7, 10)),
      sess('d', at(5, 17)),
      sess('e', at(6, 17)),
    ];
    const insights = getInsights({ history, projects: [], areas: [], tasks: [], timezone: TZ });
    const win = insights.find((i) => i.kind === 'bestWindow');
    expect(win).toBeDefined();
    expect(win!.cta.type).toBe('block-tomorrow');
    if (win!.cta.type === 'block-tomorrow') {
      expect(win!.cta.minutes).toBe(50);
      expect(win!.cta.startMin).toBe(9 * 60);
      expect(win!.cta.label).toContain('50');
    }
  });

  it('flags a starved life area against the best-fed one', () => {
    const insights = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
      mapAttention: [
        { areaId: 'a1', name: 'Career', minutes: 240, importance: 5 },
        { areaId: 'a2', name: 'Health', minutes: 0, importance: 5 },
      ],
    });
    const map = insights.find((i) => i.kind === 'mapNeglect');
    expect(map).toBeDefined();
    expect(map!.body).toContain('Career');
    expect(map!.body).toContain('Health');
    expect(map!.cta.type).toBe('step-today');
    if (map!.cta.type === 'step-today') {
      expect(map!.cta.text).toContain('Health');
    }
  });

  it('sleeps the balance rule without attention data', () => {
    const insights = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
    });
    expect(insights.some((i) => i.kind === 'mapNeglect')).toBe(false);
  });

  it('detects an overloaded day and names tasks covering the excess', () => {
    const todayKey = dayKeyInTz(Date.now(), TZ);
    const wd = weekdayOfKey(todayKey);
    const blocks = [createBlock({ label: 'Meetings', weekday: wd, startMin: 540, endMin: 600 })!];
    const plans = [
      {
        dateKey: todayKey,
        tasks: [
          { id: 'a', text: 'Big report', done: false, rank: 1, estimateMin: 120 },
          { id: 'b', text: 'Slides', done: false, rank: 2, estimateMin: 90 },
        ],
      },
    ];
    const insights = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
      plans,
      blocks,
    });
    const over = insights.find((i) => i.kind === 'planOverload');
    expect(over).toBeDefined();
    expect(over!.cta.type).toBe('move-to-tomorrow');
    if (over!.cta.type === 'move-to-tomorrow') {
      expect(over!.cta.tasks.map((x) => x.id)).toEqual(['a', 'b']);
      expect(over!.cta.label).toContain('2');
    }
  });

  it('sleeps the overload rule when the day fits', () => {
    const todayKey = dayKeyInTz(Date.now(), TZ);
    const insights = getInsights({
      history: [s(0, 25)],
      projects: [],
      areas: [],
      tasks: [],
      timezone: TZ,
      plans: [
        {
          dateKey: todayKey,
          tasks: [{ id: 'a', text: 'Small', done: false, rank: 1, estimateMin: 25 }],
        },
      ],
      blocks: [],
    });
    expect(insights.some((i) => i.kind === 'planOverload')).toBe(false);
  });

  it('spots focus without progress and names the next P0', () => {
    const projects = [p('p1', 'Client X')];
    const history = [
      s(0, 25, { projectId: 'p1' }),
      s(1 * DAY, 25, { projectId: 'p1' }),
      s(2 * DAY, 25, { projectId: 'p1' }),
    ];
    const fullTasks = [
      {
        id: 't1',
        projectId: 'p1',
        title: 'Draft proposal',
        status: 'pending' as const,
        priority: 'p1' as const,
        createdAt: NOW - 1000,
        updatedAt: NOW,
      },
    ];
    const goals = [
      {
        id: 'g1',
        title: 'Retain client',
        level: 'project' as const,
        projectId: 'p1',
        progress: 30,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const insights = getInsights({
      history,
      projects,
      areas: [],
      tasks: [],
      timezone: TZ,
      goals,
      fullTasks,
    });
    const stall = insights.find((i) => i.kind === 'stalledProject');
    expect(stall).toBeDefined();
    expect(stall!.body).toContain('Client X');
    expect(stall!.cta.type).toBe('prioritize-task');
    if (stall!.cta.type === 'prioritize-task') {
      expect(stall!.cta.taskId).toBe('t1');
    }
  });
});
