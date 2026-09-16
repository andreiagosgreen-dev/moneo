import { useMemo, useState } from 'react';
import { type Session } from '../lib/store';
import type { FocusArea } from '../lib/focusAreas';
import type { Project } from '../lib/projects';
import type { Task } from '../lib/tasks';
import { getInsights, visibleInsights, type Insight, type InsightKind } from '../lib/insights';

interface Props {
  history: Session[];
  areas: FocusArea[];
  projects: Project[];
  tasks: Task[];
  timezone: string;
  isPro?: boolean;
}

const KIND_ICON: Record<InsightKind, string> = {
  pareto: '◈',
  streak: '◆',
  bestWindow: '◓',
  neglect: '◌',
  deadline: '◉',
  nextTask: '→',
  consistency: '≈',
};

export default function InsightsCard({
  history,
  areas,
  projects,
  tasks,
  timezone,
  isPro = false,
}: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const insights = useMemo(
    () =>
      visibleInsights(getInsights({ history, projects, areas, tasks, timezone }), isPro).filter(
        (i) => !dismissed.has(i.id),
      ),
    [history, projects, areas, tasks, timezone, isPro, dismissed],
  );

  const lockedCount = useMemo(
    () =>
      isPro
        ? 0
        : getInsights({ history, projects, areas, tasks, timezone }).filter((i) => i.tier === 'pro')
            .length,
    [history, projects, areas, tasks, timezone, isPro],
  );

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Moneo insights">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Insights</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? 'AI coach · all signals' : 'AI coach · limited'}
          </p>
        </div>
        <span
          className="rounded-full bg-ink/60 px-3 py-1 font-mono text-[11px] text-sage ring-1 ring-line"
          title="Deterministic rules over your focus history — no data leaves this device"
        >
          local
        </span>
      </header>

      {insights.length === 0 && !lockedCount ? (
        <p className="mt-5 text-[13px] leading-relaxed text-faint">
          No insights yet. Complete a few focus rounds and Moneo will start spotting patterns in
          when and where you work best.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {insights.map((ins) => (
            <InsightRow key={ins.id} insight={ins} onDismiss={() => dismiss(ins.id)} />
          ))}
        </ul>
      )}

      {!isPro && lockedCount > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-ink/60 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-semibold text-cream">
                {lockedCount} Pro insight{lockedCount > 1 ? 's' : ''} locked
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-sage">
                Upgrade to Moneo Pro for priority coaching, deadline alerts, and your best focus
                window.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function InsightRow({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  return (
    <li className="group rounded-xl border border-line/70 bg-ink/40 p-3.5 transition-colors hover:border-line">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[13px] text-accent"
          aria-hidden
        >
          {KIND_ICON[insight.kind]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-cream">{insight.title}</h3>
            {insight.tier === 'pro' && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                Pro
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-sage">{insight.body}</p>
        </div>
        <button
          onClick={onDismiss}
          aria-label={`Dismiss insight: ${insight.title}`}
          className="press shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[13px] text-faint opacity-0 transition-opacity hover:text-sage focus:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    </li>
  );
}
