import { describe, expect, it } from 'vitest';
import { executeInsightCta, type CtaCtx, type CtaState } from './insightActions';
import type { InsightCta } from './insights';
import { dayKeyInTz } from './timezone';
import { nextDayKey } from './ritual';

// Dynamic keys: setDayPlan prunes anything older than 90 days,
// so fixed calendar fixtures would silently rot.
const TODAY = dayKeyInTz(Date.now(), 'UTC');
const TOMORROW = nextDayKey(TODAY);

const CTX: CtaCtx = { todayKey: TODAY, maxIvy: 6, blockLabel: 'Deep work' };

function state(): CtaState {
  return {
    plans: [
      {
        dateKey: TODAY,
        tasks: [
          { id: 't1', text: 'Big report', done: false, rank: 1, estimateMin: 120 },
          { id: 't2', text: 'Slides', done: false, rank: 2, estimateMin: 90 },
        ],
      },
    ],
    blocks: [],
    tasks: [
      {
        id: 't9',
        projectId: 'p1',
        title: 'Draft proposal',
        status: 'pending',
        priority: 'p1',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
}

function todayTasks(out: CtaState) {
  return out.plans.find((p) => p.dateKey === TODAY)!.tasks;
}

describe('executeInsightCta', () => {
  it('creates a bounded block tomorrow for block-tomorrow', () => {
    const cta: InsightCta = { type: 'block-tomorrow', minutes: 50, startMin: 540, label: 'x' };
    const out = executeInsightCta(state(), cta, CTX);
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0].startMin).toBe(540);
    expect(out.blocks[0].endMin).toBe(590);
  });

  it('refuses invalid windows without touching state', () => {
    const s = state();
    const bad: InsightCta = { type: 'block-tomorrow', minutes: 50, startMin: 1400, label: 'x' };
    expect(executeInsightCta(s, bad, CTX)).toBe(s);
    const neg: InsightCta = { type: 'block-tomorrow', minutes: -5, startMin: 540, label: 'x' };
    expect(executeInsightCta(s, neg, CTX)).toBe(s);
  });

  it('adds step-today text and respects a full list', () => {
    const cta: InsightCta = { type: 'step-today', text: '10 minutes for Health.', label: 'x' };
    const out = executeInsightCta(state(), cta, CTX);
    expect(todayTasks(out).map((x) => x.text)).toContain('10 minutes for Health.');
    const full: CtaState = {
      ...state(),
      plans: [
        {
          dateKey: TODAY,
          tasks: Array.from({ length: 6 }, (_, i) => ({
            id: `f${i}`,
            text: `F${i}`,
            done: false,
            rank: i + 1,
          })),
        },
      ],
    };
    expect(executeInsightCta(full, cta, CTX)).toBe(full);
  });

  it('carries estimates on add-to-plan', () => {
    const cta: InsightCta = { type: 'add-to-plan', title: 'Fix auth', estimateMin: 50, label: 'x' };
    const out = executeInsightCta(state(), cta, CTX);
    const added = todayTasks(out).find((x) => x.text === 'Fix auth')!;
    expect(added.estimateMin).toBe(50);
  });

  it('moves tasks to tomorrow and skips unknown ids', () => {
    const cta: InsightCta = {
      type: 'move-to-tomorrow',
      tasks: [
        { id: 't1', text: 'Big report', estimateMin: 120 },
        { id: 'ghost', text: 'Ghost', estimateMin: 10 },
      ],
      label: 'x',
    };
    const out = executeInsightCta(state(), cta, CTX);
    const today = todayTasks(out).map((x) => x.id);
    const tomorrow = out.plans.find((p) => p.dateKey === TOMORROW)!.tasks.map((x) => x.text);
    expect(today).not.toContain('t1');
    expect(today).toContain('t2');
    expect(tomorrow).toContain('Big report');
    expect(tomorrow).not.toContain('Ghost');
  });

  it('never loses work when tomorrow is full (regression)', () => {
    const s = state();
    const tomorrowFull: CtaState = {
      ...s,
      plans: [
        ...s.plans,
        {
          dateKey: TOMORROW,
          tasks: Array.from({ length: 6 }, (_, i) => ({
            id: `m${i}`,
            text: `M${i}`,
            done: false,
            rank: i + 1,
          })),
        },
      ],
    };
    const cta: InsightCta = {
      type: 'move-to-tomorrow',
      tasks: [{ id: 't1', text: 'Big report', estimateMin: 120 }],
      label: 'x',
    };
    const out = executeInsightCta(tomorrowFull, cta, CTX);
    // Nothing moved, nothing lost: identical state reference.
    expect(out).toBe(tomorrowFull);
    expect(todayTasks(out).map((x) => x.id)).toContain('t1');
  });

  it('prioritizes known tasks and ignores unknown ids', () => {
    const s = state();
    const out = executeInsightCta(
      s,
      { type: 'prioritize-task', taskId: 't9', title: 'Draft proposal', label: 'x' },
      CTX,
    );
    expect(out.tasks.find((x) => x.id === 't9')!.priority).toBe('p0');
    expect(
      executeInsightCta(
        s,
        { type: 'prioritize-task', taskId: 'nope', title: 'x', label: 'y' },
        CTX,
      ),
    ).toBe(s);
    expect(executeInsightCta(s, { type: 'none' }, CTX)).toBe(s);
  });
});
