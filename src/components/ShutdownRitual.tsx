import { useMemo, useState } from 'react';
import type { Session } from '../lib/store';
import type { IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { nextDayKey, shutdownSummary } from '../lib/ritual';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { reviewLine } from '../lib/ai/coach';

interface Props {
  history: Session[];
  plans: IvyPlan[];
  timezone: string;
  frogEaten: boolean;
  onMoveToTomorrow: (texts: string[]) => void;
  onDone: () => void;
}

export default function ShutdownRitual({
  history,
  plans,
  timezone,
  frogEaten,
  onMoveToTomorrow,
  onDone,
}: Props) {
  const todayKey = dayKeyInTz(Date.now(), timezone);
  const { t, fmtDur, fmtDayKey } = useI18n();
  const summary = useMemo(
    () => shutdownSummary(history, plans, todayKey, timezone),
    [history, plans, todayKey, timezone],
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set(summary.unfinished));

  const toggle = (text: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });

  const move = () => {
    onMoveToTomorrow(summary.unfinished.filter((t) => checked.has(t)));
    onDone();
  };

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('shutdown.dialog')}
    >
      <div className="dialog-pop card max-h-[90vh] w-full max-w-md overflow-y-auto px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t('shutdown.kicker')}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">
          {t('shutdown.headline')}
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-ink/40 px-3 py-2.5 text-center ring-1 ring-inset ring-line">
            <div className="font-display text-xl font-bold text-cream">
              {fmtDur(summary.minutes)}
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              {t('shutdown.statFocused')}
            </div>
          </div>
          <div className="rounded-xl bg-ink/40 px-3 py-2.5 text-center ring-1 ring-inset ring-line">
            <div className="font-display text-xl font-bold text-cream">
              {summary.done}/{summary.total || '—'}
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              {t('shutdown.statPlanned')}
            </div>
          </div>
          <div className="rounded-xl bg-ink/40 px-3 py-2.5 text-center ring-1 ring-inset ring-line">
            <div className="font-display text-xl font-bold text-cream">
              {frogEaten ? '🐸' : '—'}
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
              {t('shutdown.statFrog')}
            </div>
          </div>
        </div>

        {(() => {
          const line = reviewLine(summary.done, summary.unfinished.length);
          return (
            <p className="mt-3 text-[13px] leading-relaxed text-cream/90">
              {t(line.key as TKey, line.vars)}
            </p>
          );
        })()}

        {summary.unfinished.length > 0 ? (
          <div className="mt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {t('shutdown.carry')}
            </p>
            <ul className="mt-2 space-y-1.5">
              {summary.unfinished.map((text) => (
                <li key={text}>
                  <button
                    onClick={() => toggle(text)}
                    aria-pressed={checked.has(text)}
                    className={`press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors ${
                      checked.has(text)
                        ? 'bg-accent/10 text-cream ring-accent/40'
                        : 'bg-ink/40 text-sage ring-line'
                    }`}
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center rounded ring-1 ring-inset ${
                        checked.has(text)
                          ? 'bg-accent text-on-accent ring-accent'
                          : 'bg-ink/60 text-transparent ring-line'
                      }`}
                      style={{ width: 18, height: 18 }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-faint">
              {t('shutdown.carryNote', { date: fmtDayKey(nextDayKey(todayKey)) })}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-line bg-ink/40 px-4 py-3 text-[13px] leading-relaxed text-sage">
            {summary.total > 0 ? t('shutdown.allDone') : t('shutdown.noPlan')}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            onClick={onDone}
            className="press rounded-lg px-3 py-2 font-mono text-[12px] text-faint hover:text-cream"
          >
            {t('shutdown.close')}
          </button>
          {summary.unfinished.length > 0 && (
            <button
              onClick={move}
              disabled={checked.size === 0}
              className="press btn-accent rounded-lg px-6 py-2 font-display text-[13px] font-bold disabled:opacity-40"
            >
              {t('shutdown.move', { n: checked.size })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
