import { useEffect, useMemo } from 'react';
import type { Project } from '../lib/projects';
import { localDayKey } from '../lib/projects';
import type { Task } from '../lib/tasks';
import { completeTask } from '../lib/tasks';
import {
  frogStats,
  loadFrogLog,
  pickFrog,
  recordFrog,
  saveFrogLog,
  type FrogLog,
} from '../lib/frog';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  tasks: Task[];
  projects: Project[];
  frogLog: FrogLog;
  frogLogChange: (log: FrogLog) => void;
  onTasksChange: (tasks: Task[]) => void;
  isPro?: boolean;
}

export default function FrogCard({
  tasks,
  projects,
  frogLog,
  frogLogChange,
  onTasksChange,
  isPro = false,
}: Props) {
  const now = useMemo(() => Date.now(), []);
  const { t, tag, fmtNum } = useI18n();
  const todayKey = localDayKey(now);
  const frog = useMemo(() => pickFrog(tasks, projects, now), [tasks, projects, now]);
  const stats = useMemo(() => frogStats(frogLog, now), [frogLog, now]);
  const todayEntry = frogLog[todayKey];

  // Record today's pick once (and flip to done when the task completes anywhere).
  useEffect(() => {
    if (!frog) return;
    const entry = frogLog[todayKey];
    const done = frog.status === 'completed' || entry?.done === true;
    if (!entry || entry.taskId !== frog.id || entry.done !== done) {
      const next = recordFrog(frogLog, todayKey, frog.id, done);
      saveFrogLog(next);
      frogLogChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frog?.id, frog?.status, todayKey]);

  const eatFrog = () => {
    if (!frog || frog.status === 'completed') return;
    const { tasks: next } = completeTask(tasks, frog.id);
    onTasksChange(next);
    const log = recordFrog(loadFrogLog(), todayKey, frog.id, true);
    saveFrogLog(log);
    frogLogChange(log);
  };

  const eaten = frog?.status === 'completed' || todayEntry?.done === true;
  const dueLabel =
    frog && typeof frog.dueAt === 'number'
      ? t('frog.due', {
          date: new Date(frog.dueAt).toLocaleDateString(tag, { month: 'short', day: 'numeric' }),
        })
      : '';

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('frog.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('frog.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t('frog.sub')}
          </p>
        </div>
        {isPro && stats.days > 0 && (
          <span className="font-mono text-[11px] text-sage" title={t('frog.streakTitle')}>
            🔥 {fmtNum(stats.streak)}
          </span>
        )}
      </header>

      {!frog ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('frog.emptyA')}
          <br />
          {t('frog.emptyB')}
        </p>
      ) : (
        <div className="mt-4 rounded-xl bg-ink/40 px-4 py-3.5 ring-1 ring-inset ring-line">
          <p
            className={`text-[15px] font-semibold text-cream ${eaten ? 'line-through opacity-60' : ''}`}
          >
            {eaten ? '🎉 ' : '🐸 '}
            {frog.title}
          </p>
          <p className="mt-1 font-mono text-[11px] text-faint">
            {frog.priority.toUpperCase()}
            {dueLabel}
            {t(eaten ? 'frog.eaten' : 'frog.uneaten')}
          </p>
          {!eaten && (
            <button
              onClick={eatFrog}
              className="press btn-accent mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {t('frog.eat')}
            </button>
          )}
        </div>
      )}

      {isPro && stats.days > 0 && (
        <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-faint">
          <span title={t('frog.ateTitle')}>
            <span className="font-bold text-cream">{fmtNum(stats.done)}</span>/
            {fmtNum(stats.days)} {t('frog.ateNoun')}
          </span>
          <span title={t('frog.skipTitle')}>
            <span className="font-bold text-tomato">{fmtNum(stats.skipped)}</span>{' '}
            {t('frog.skipNoun')}
          </span>
          <span className="ml-auto">{Math.round(stats.rate * 100)}%</span>
        </div>
      )}
      {!isPro && (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-faint">{t('frog.proNote')}</p>
      )}
    </section>
  );
}
