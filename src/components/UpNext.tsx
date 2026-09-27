import { useMemo, useState } from 'react';
import type { TimeBlock } from '../lib/timeBlocks';
import { nextFocusBlock, weekdayOfKey, minuteOfDayInTz } from '../lib/timeBlocks';
import type { Task } from '../lib/tasks';
import type { Project } from '../lib/projects';
import type { Goal } from '../lib/goals';
import { rootGoals, goalProgress } from '../lib/goals';
import { pickFrog } from '../lib/frog';
import { quadrantFocus } from '../lib/eisenhower';
import {
  addTaskToDay,
  planForDay,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
  type IvyPlan,
} from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  blocks: TimeBlock[];
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  isPro?: boolean;
}

interface Props {
  blocks: TimeBlock[];
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  plans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  isPro?: boolean;
}

interface Recommendation {
  title: string;
  source: string;
}

/**
 * "Up next" hero for the Today view (Roadmap Faza 2): the running or next
 * focus block plus exactly one recommendation (frog → focus pick → goal),
 * each with a single clear action. Calm by design — no lists, no charts.
 */
export default function UpNext({
  blocks,
  tasks,
  projects,
  goals,
  plans,
  plansChange,
  timezone,
  isPro = false,
}: Props) {
  const [addedTick, setAddedTick] = useState(0);
  const { t, fmtClock } = useI18n();
  const now = Date.now();
  const todayKey = dayKeyInTz(now, timezone);
  const maxIvy = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;

  const next = useMemo(
    () => nextFocusBlock(blocks, weekdayOfKey(todayKey), minuteOfDayInTz(now, timezone)),
    // Recompute on each render while visible; cheap and always current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks, todayKey, timezone, addedTick],
  );

  const recommendation: Recommendation | null = useMemo(() => {
    const frog = pickFrog(tasks, projects, now);
    if (frog) return { title: frog.title, source: t('upnext.src.frog') };
    const focus = quadrantFocus(tasks, now);
    if (focus.task) return { title: focus.task.title, source: t('upnext.src.matrix') };
    const goal = rootGoals(goals).find(
      (g) => !g.archived && goalProgress(goals, tasks, g.id) < 100,
    );
    if (goal) return { title: goal.title, source: t('upnext.src.goal') };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, projects, goals, addedTick, t]);

  const onPlan = () => {
    if (!recommendation) return;
    const { plans: nextPlans, added } = addTaskToDay(plans, todayKey, recommendation.title, maxIvy);
    if (!added) return;
    plansChange(nextPlans);
    // Bump the tick so the memo above recomputes and flips to "on the list".
    setAddedTick((t) => t + 1);
  };

  const onList = recommendation
    ? (planForDay(plans, todayKey)?.tasks.some((t) => t.text === recommendation.title) ?? false)
    : false;

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('upnext.title')}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">
        {t('upnext.title')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-ink/40 px-4 py-3.5 ring-1 ring-inset ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
            {next ? (next.state === 'now' ? t('upnext.now') : t('upnext.next')) : t('upnext.none')}
          </p>
          {next ? (
            <>
              <p className="mt-1.5 truncate text-[16px] font-semibold text-cream">
                {next.block.label}
              </p>
              <p className="mt-0.5 text-[13px] text-sage">
                {fmtClock(next.block.startMin)}–{fmtClock(next.block.endMin)}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[14px] leading-relaxed text-sage">{t('upnext.noneBody')}</p>
          )}
        </div>
        <div className="rounded-xl bg-ink/40 px-4 py-3.5 ring-1 ring-inset ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
            {t('upnext.rec')}
          </p>
          {recommendation ? (
            <>
              <p
                className="mt-1.5 truncate text-[16px] font-semibold text-cream"
                title={recommendation.title}
              >
                {recommendation.title}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-[13px] text-sage">{recommendation.source}</p>
                {onList ? (
                  <span className="shrink-0 text-[13px] font-semibold text-mint">
                    {t('upnext.onList')}
                  </span>
                ) : (
                  <button
                    onClick={onPlan}
                    className="press btn-accent shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-bold"
                    aria-label={t('upnext.addAria', { title: recommendation.title })}
                  >
                    {t('upnext.add')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="mt-1.5 text-[14px] leading-relaxed text-sage">{t('upnext.recEmpty')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
