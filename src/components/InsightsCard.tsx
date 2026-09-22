import { useMemo, useState } from 'react';
import { type Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import type { Project } from '../lib/projects';
import type { Task } from '../lib/tasks';
import {
  getInsights,
  visibleInsights,
  loadDismissedInsights,
  saveDismissedInsights,
  type Insight,
  type InsightKind,
  type MapAttention,
} from '../lib/insights';
import type { Goal } from '../lib/goals';
import { weeklyReview, type LifeMapArea } from '../lib/lifemap';
import { executeInsightCta } from '../lib/insightActions';
import { IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import type { TimeBlock } from '../lib/timeBlocks';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  history: Session[];
  areas: FocusArea[];
  projects: Project[];
  tasks: Task[];
  timezone: string;
  goals?: Goal[];
  isPro?: boolean;
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  blocks: TimeBlock[];
  blocksChange: (blocks: TimeBlock[]) => void;
  onTasksChange: (tasks: Task[]) => void;
  lifeMapAreas?: LifeMapArea[];
  habitLog?: Record<string, string[]>;
}

const KIND_ICON: Record<InsightKind, string> = {
  pareto: '◈',
  streak: '◆',
  bestWindow: '◓',
  neglect: '◌',
  deadline: '◉',
  nextTask: '→',
  consistency: '≈',
  milestone: '🎉',
  pace: '➤',
  mapNeglect: '◍',
  planOverload: '▣',
  stalledProject: '◎',
};

const CONF_DOT: Record<Insight['confidence'], string> = {
  high: 'bg-mint',
  medium: 'bg-accent',
  low: 'bg-faint',
};

export default function InsightsCard({
  history,
  areas,
  projects,
  tasks,
  timezone,
  goals,
  isPro = false,
  plans,
  plansChange,
  blocks,
  blocksChange,
  onTasksChange,
  lifeMapAreas,
  habitLog,
}: Props) {
  const i18n = useI18n();
  const { t, tp } = i18n;
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set(loadDismissedInsights()));
  const [acted, setActed] = useState<Set<string>>(new Set());

  const mapAttention = useMemo<MapAttention[] | undefined>(() => {
    if (!lifeMapAreas || lifeMapAreas.length === 0) return undefined;
    const review = weeklyReview(lifeMapAreas, history, habitLog ?? {}, Date.now());
    const byId = new Map(review.attended.map((r) => [r.area.id, r.minutes]));
    return lifeMapAreas.map((a) => ({
      areaId: a.id,
      name: a.name,
      minutes: byId.get(a.id) ?? 0,
      importance: a.importance,
    }));
  }, [lifeMapAreas, history, habitLog]);

  const all = useMemo(
    () =>
      getInsights(
        {
          history,
          projects,
          areas,
          tasks,
          timezone,
          goals,
          fullTasks: tasks,
          plans,
          blocks,
          mapAttention,
        },
        i18n,
      ),
    [history, projects, areas, tasks, timezone, goals, plans, blocks, mapAttention, i18n],
  );

  const insights = useMemo(
    () => visibleInsights(all, isPro).filter((i) => !dismissed.has(i.id)),
    [all, isPro, dismissed],
  );
  const lockedCount = useMemo(
    () => (isPro ? 0 : all.filter((i) => i.tier === 'pro').length),
    [all, isPro],
  );

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      saveDismissedInsights([...next]);
      return next;
    });
  };

  const maxIvy = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const todayKey = dayKeyInTz(Date.now(), timezone);

  /** Execute an insight CTA (tap = approval). Single explicit action only. */
  const runCta = (ins: Insight) => {
    if (ins.cta.type === 'none' || acted.has(ins.id)) return;
    const before = { plans, blocks, tasks };
    const after = executeInsightCta(before, ins.cta, {
      todayKey,
      maxIvy,
      blockLabel: t('ins.ui.blockLabel'),
    });
    if (after === before) return;
    if (after.plans !== before.plans) plansChange(after.plans);
    if (after.blocks !== before.blocks) blocksChange(after.blocks);
    if (after.tasks !== before.tasks) onTasksChange(after.tasks);
    setActed((prev) => new Set(prev).add(ins.id));
  };

  return (
    <section className="card overflow-hidden px-6 py-6 sm:px-7" aria-label={t('ins.ui.title')}>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('ins.ui.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t(isPro ? 'ins.ui.subPro' : 'ins.ui.subFree')}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full bg-ink/60 px-3 py-1 font-mono text-[11px] text-sage ring-1 ring-line"
          title={t('ins.ui.localTitle')}
        >
          {t('ins.ui.local')}
        </span>
      </header>

      {insights.length === 0 && !lockedCount ? (
        <p className="mt-5 text-[13px] leading-relaxed text-faint">{t('ins.ui.empty')}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {insights.map((ins) => (
            <InsightRow
              key={ins.id}
              insight={ins}
              acted={acted.has(ins.id)}
              onAct={() => runCta(ins)}
              onDismiss={() => dismiss(ins.id)}
            />
          ))}
        </ul>
      )}

      {!isPro && lockedCount > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-ink/60 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-cream">
                {tp('ins.ui.locked', lockedCount)}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">{t('ins.ui.lockedBody')}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function InsightRow({
  insight,
  acted,
  onAct,
  onDismiss,
}: {
  insight: Insight;
  acted: boolean;
  onAct: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const confLabel =
    insight.confidence === 'high'
      ? t('ins.conf.high')
      : insight.confidence === 'medium'
        ? t('ins.conf.medium')
        : t('ins.conf.low');
  return (
    <li className="insight-row group">
      <div className="flex items-start gap-3 pr-6">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[13px] text-accent"
          aria-hidden
        >
          {KIND_ICON[insight.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 text-[13px] font-semibold text-cream">{insight.title}</h3>
            {insight.tier === 'pro' && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                Pro
              </span>
            )}
            <span
              className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px] text-faint"
              title={`${t('ins.ui.confLabel')}: ${confLabel}`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${CONF_DOT[insight.confidence]}`}
                aria-hidden
              />
              {confLabel}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-sage">{insight.body}</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-mono text-[10px] text-faint hover:text-sage">
              {t('ins.ui.why')}
            </summary>
            <p className="mt-1 text-[11px] leading-relaxed text-sage">{insight.reason}</p>
            <p className="mt-0.5 font-mono text-[10px] text-faint">
              {t('ins.ui.dataLabel')}: {insight.dataUsed}
            </p>
          </details>
          {insight.cta.type !== 'none' && (
            <div className="mt-2.5">
              {acted ? (
                <span className="font-mono text-[11px] font-semibold text-mint">
                  {t('ins.ui.done')}
                </span>
              ) : (
                <button
                  onClick={onAct}
                  className="press btn-accent rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold"
                >
                  {insight.cta.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label={t('ins.ui.dismiss', { title: insight.title })}
        className="insight-row-dismiss press rounded-md px-1.5 py-0.5 font-mono text-[13px] text-faint opacity-0 transition-opacity hover:text-sage focus:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
