import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Session } from '../lib/store';
import type { Project } from '../lib/projects';
import type { Task } from '../lib/tasks';
import type { Goal } from '../lib/goals';
import {
  buildWeeklyRecap,
  downloadRecapImage,
  drawRecapCard,
  shareRecapImage,
  type RecapStrings,
} from '../lib/recap';

interface Props {
  history: Session[];
  projects: Project[];
  tasks: Task[];
  goals: Goal[];
  timezone: string;
}

/**
 * Weekly Recap: one auto-generated, shareable week card.
 * Totals, daily bars, top movers with live percents, goals in motion,
 * streak. Share uses the system sheet with a PNG; download is the
 * fallback. Image export is Free — the recap is the viral loop.
 */
export default function WeeklyRecapCard({ history, projects, tasks, goals, timezone }: Props) {
  const { t, tp, tag, fmtDur, fmtNum } = useI18n();
  const [note, setNote] = useState<'saved' | 'unavailable' | null>(null);

  const recap = useMemo(
    () => buildWeeklyRecap({ history, projects, tasks, goals, timezone }),
    [history, projects, tasks, goals, timezone],
  );

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 4000);
    return () => window.clearTimeout(id);
  }, [note]);

  if (recap.sessionCount === 0) {
    return (
      <section className="card px-6 py-6 sm:px-7" aria-label={t('recap.title')}>
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('recap.title')}
        </h2>
        <p className="mt-1 text-[12px] text-sage">{t('recap.sub')}</p>
        <div className="empty-panel mt-4">
          <p className="text-[13px] text-sage">{t('recap.empty')}</p>
        </div>
      </section>
    );
  }

  const strings: RecapStrings = {
    title: t('recap.title'),
    weekLabel: t('rep.rangeLabel.week'),
    sessionsLabel: t('rep.sessions'),
    streakLine: tp('stats.streak', recap.streak),
    topLabel: t('rep.topProject').replace(/:$/, ''),
    brand: 'Moneo',
  };

  const paint = (): HTMLCanvasElement | null => {
    try {
      const canvas = document.createElement('canvas');
      if (!drawRecapCard(canvas, recap, strings, (m) => fmtDur(m))) return null;
      return canvas;
    } catch {
      return null;
    }
  };

  const stamp = () => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return 'week';
    }
  };

  const onShare = async () => {
    const canvas = paint();
    if (!canvas) {
      setNote('unavailable');
      return;
    }
    const filename = `moneo-weekly-recap-${stamp()}.png`;
    if (await shareRecapImage(canvas, { title: t('recap.title'), text: t('recap.sub'), filename })) {
      return;
    }
    setNote((await downloadRecapImage(canvas, filename)) ? 'saved' : 'unavailable');
  };

  const onDownload = async () => {
    const canvas = paint();
    if (!canvas) {
      setNote('unavailable');
      return;
    }
    setNote(
      (await downloadRecapImage(canvas, `moneo-weekly-recap-${stamp()}.png`))
        ? 'saved'
        : 'unavailable',
    );
  };

  const maxDay = Math.max(1, ...recap.days.map((d) => d.min));

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('recap.title')}>
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('recap.title')}
        </h2>
        <p className="mt-1 text-[12px] text-sage">{t('recap.sub')}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-4">
        <div>
          <div
            className="font-display text-3xl font-extrabold leading-none"
            style={{ color: 'var(--accent)' }}
          >
            {fmtDur(recap.totalMin)}
          </div>
          <div className="mt-1 text-[12px] text-sage">{t('rep.total')}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-mono text-[22px] font-bold text-cream">
            {fmtNum(recap.sessionCount)}
          </div>
          <div className="mt-1 text-[12px] text-sage">{t('rep.sessions')}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[22px] font-bold text-cream">{fmtNum(recap.streak)}</div>
          <div className="mt-1 text-[12px] text-sage">{tp('stats.streak', recap.streak)}</div>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-1" style={{ height: 72 }} aria-hidden="true">
        {recap.days.map((d) => {
          const pct = d.min === 0 ? 0 : Math.max(5, (d.min / maxDay) * 100);
          let label = d.key;
          try {
            const [y, m, dd] = d.key.split('-').map(Number);
            label = new Date(y, m - 1, dd).toLocaleDateString(tag, {
              weekday: 'narrow',
            });
          } catch {
            /* keep raw key */
          }
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1" title={label}>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${pct}%`,
                    background:
                      d.min > 0 ? 'var(--accent)' : 'rgb(242 244 249 / 0.08)',
                  }}
                />
              </div>
              <span className="font-mono text-[9px] uppercase text-faint">{label}</span>
            </div>
          );
        })}
      </div>

      {recap.topProjects.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line/60 pt-3">
          {recap.topProjects.map((p) => (
            <div key={p.projectId}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] text-cream/90">{p.name}</span>
                <span className="shrink-0 font-mono text-[12px] text-sage">
                  {fmtDur(p.min)}
                  {p.pct !== null && <span className="ml-1 text-faint">({fmtNum(p.pct)}%)</span>}
                </span>
              </div>
              {p.pct !== null && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line/50">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.pct}%`, background: p.color }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {recap.goalsInMotion.length > 0 && (
        <p className="mt-3 text-[12px] text-sage">
          {recap.goalsInMotion.map((g) => `◆ ${g.title} · ${fmtNum(g.pct)}%`).join('   ')}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line/60 pt-4">
        <button
          onClick={() => void onShare()}
          className="press btn-accent rounded-lg px-4 py-2 font-mono text-[12px] font-semibold"
        >
          {t('recap.share')}
        </button>
        <button
          onClick={() => void onDownload()}
          className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px] font-semibold"
        >
          {t('recap.download')}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 font-mono text-[11px] text-sage">
          {note === 'saved' ? t('recap.saved') : t('recap.unavailable')}
        </p>
      )}
    </section>
  );
}
