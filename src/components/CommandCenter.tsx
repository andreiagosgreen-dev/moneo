import { useMemo } from 'react';
import { type Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import type { Project } from '../lib/projects';
import {
  type Task,
  tasksForProject,
  projectCompletion,
  STATUS_LABELS,
  TASK_STATUSES,
} from '../lib/tasks';
import { type Goal, goalForProject, goalAncestry } from '../lib/goals';
import { type Sprint, activeSprint } from '../lib/sprints';
import { buildReport } from '../lib/reports';
import { effectiveQuadrant, QUADRANT_META } from '../lib/eisenhower';
import { type Habit, type HabitLog, habitStreak } from '../lib/habits';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  projects: Project[];
  tasks: Task[];
  goals: Goal[];
  sprints: Sprint[];
  history: Session[];
  areas: FocusArea[];
  habits: Habit[];
  habitLog: HabitLog;
  timezone: string;
  selectedProjectId: string | null;
  selectedTaskId: string | null;
}

const MAX_BOARD_CARDS = 3;

export default function CommandCenter({
  projects,
  tasks,
  goals,
  sprints,
  history,
  areas,
  habits,
  habitLog,
  timezone,
  selectedProjectId,
  selectedTaskId,
}: Props) {
  const { t, tp, fmtDayKey } = useI18n();

  const project = useMemo(
    () =>
      projects.find((p) => p.id === selectedProjectId && !p.archived) ??
      projects.find((p) => !p.archived) ??
      null,
    [projects, selectedProjectId],
  );

  const scoped = useMemo(
    () => (project ? tasksForProject(tasks, project.id) : []),
    [tasks, project],
  );

  const goal = project ? goalForProject(goals, project.id) : null;
  const ancestry = goal ? goalAncestry(goals, goal.id) : [];
  const sprint = project ? activeSprint(sprints, project.id) : null;
  const completion = project ? projectCompletion(tasks, project.id) : { done: 0, total: 0 };

  const focusTask = useMemo(
    () =>
      tasks.find((x) => x.id === selectedTaskId) ??
      scoped.find((x) => x.status !== 'completed') ??
      null,
    [tasks, scoped, selectedTaskId],
  );

  const activeHabit = habits.find((h) => !h.archived) ?? null;
  const streak = activeHabit ? habitStreak(activeHabit, habitLog) : 0;

  const week = useMemo(
    () => buildReport(history, projects, areas, tasks, 'week', timezone).days,
    [history, projects, areas, tasks, timezone],
  );
  const weekMax = Math.max(1, ...week.map((d) => d.min));

  if (!project) return null;

  const pct = completion.total > 0 ? Math.round((completion.done / completion.total) * 100) : 0;

  return (
    <section className="card px-5 py-5 sm:px-6" aria-label={t('commandCenter.title')}>
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">
            {t('commandCenter.title')}
          </p>
          <h2 className="mt-1 truncate font-display text-[17px] font-bold text-cream">
            {project.name}
          </h2>
        </div>
        <div className="relative h-11 w-11 shrink-0">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-line)" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 113} 113`}
              transform="rotate(-90 22 22)"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] font-bold text-cream">
            {pct}%
          </span>
        </div>
      </header>

      {(goal || sprint) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {ancestry.length > 0 && (
            <span className="rounded-full bg-ink/40 px-2.5 py-1 text-[12px] text-sage ring-1 ring-inset ring-line">
              {ancestry.map((g) => g.title).join(' › ')}
            </span>
          )}
          {sprint && (
            <span className="rounded-full bg-ink/40 px-2.5 py-1 text-[12px] font-medium text-sage ring-1 ring-inset ring-line">
              {sprint.name}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const col = scoped.filter((x) => x.status === status).slice(0, MAX_BOARD_CARDS);
          const colTotal = scoped.filter((x) => x.status === status).length;
          return (
            <div
              key={status}
              className="rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset ring-line"
            >
              <p className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
                {STATUS_LABELS[status]}
                <span>{colTotal}</span>
              </p>
              <ul className="mt-1.5 space-y-1">
                {col.map((x) => (
                  <li
                    key={x.id}
                    className="truncate rounded-md bg-card/60 px-2 py-1.5 text-[13px] text-cream/90"
                  >
                    {x.title}
                  </li>
                ))}
                {colTotal === 0 && <li className="text-[13px] text-sage">—</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
            {t('commandCenter.week')}
          </p>
          <div className="mt-2 flex items-end gap-1" style={{ height: 36 }}>
            {week.map((d) => (
              <div
                key={d.key}
                title={`${fmtDayKey(d.key)} · ${d.min}m`}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(4, (d.min / weekMax) * 36)}px`,
                  background: d.min > 0 ? 'var(--accent)' : 'var(--color-line)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-ink/40 px-3 py-2.5 ring-1 ring-inset ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
            {t('commandCenter.focus')}
          </p>
          {focusTask ? (
            <>
              <p className="mt-1.5 truncate text-[14px] font-semibold text-cream">
                {focusTask.title}
              </p>
              <p className="mt-0.5 text-[13px] text-sage">
                {t(QUADRANT_META[effectiveQuadrant(focusTask)].title)}
                {activeHabit && streak > 0 && ` · ${tp('commandCenter.streak', streak)}`}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[13px] text-sage">{t('commandCenter.noFocus')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
