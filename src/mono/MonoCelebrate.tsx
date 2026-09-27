import { useEffect, useRef, type CSSProperties } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { type Moment, type MomentKind, confettiCount, momentDuration } from '../lib/moments';
import { runConfetti } from './confetti';

interface Props {
  moment: Moment;
  onDone: () => void;
}

const KICKER: Record<MomentKind, TKey> = {
  session: 'mono.celebrate.kicker.session',
  milestone: 'mono.celebrate.kicker.milestone',
  phase: 'mono.celebrate.kicker.phase',
  project: 'mono.celebrate.kicker.project',
};

const SESSION_LINES: TKey[] = [
  'mono.celebrate.session1',
  'mono.celebrate.session2',
  'mono.celebrate.session3',
];

const ICON: Record<MomentKind, string> = {
  session: 'M12 3a9 9 0 1 0 9 9M8.5 12.5l2.5 2.5 6-6',
  milestone: 'M12 3l7 9-7 9-7-9zM12 8.5v7',
  phase: 'M4 19h4v-4h4v-4h4V7h4M4 19V5',
  project: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
};

const CONFETTI_VARS = ['--atm-accent', '--mono-accent', '--mono-accent-2', '--mono-success'];

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/**
 * One calm celebration: a small card at the top, a short burst of confetti in
 * the atmosphere's colors, then it leaves on its own. Never takes focus,
 * never blocks the screen underneath; Esc or × closes it early.
 */
export default function MonoCelebrate({ moment, onDone }: Props) {
  const { t, fmtDur } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const duration = momentDuration(moment.kind);

  useEffect(() => {
    const id = window.setTimeout(() => doneRef.current(), duration);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') doneRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [moment.id, duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const count = confettiCount(moment.kind, prefersReducedMotion());
    const style = getComputedStyle(canvas);
    const colors = CONFETTI_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
    return runConfetti(canvas, {
      count,
      originY: Math.min(260, window.innerHeight * 0.32),
      colors,
      seed: moment.id.length * 7919 + (moment.minutes ?? 0),
    });
  }, [moment.id, moment.kind, moment.minutes]);

  const message =
    moment.kind === 'session'
      ? t(SESSION_LINES[moment.variant % SESSION_LINES.length], {
          dur: fmtDur(moment.minutes ?? 0),
        })
      : t(`mono.celebrate.${moment.kind}` as TKey, { name: moment.label ?? '' });

  return (
    <>
      <canvas ref={canvasRef} className="mono-confetti" aria-hidden />
      <div
        key={moment.id}
        role="status"
        aria-live="polite"
        className={`mono-celebrate is-${moment.kind}`}
        style={{ '--celebrate-ms': `${duration}ms` } as CSSProperties}
      >
        <span className="mono-celebrate-icon" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d={ICON[moment.kind]} />
          </svg>
        </span>
        <div className="mono-celebrate-copy">
          <p className="mono-celebrate-kicker">{t(KICKER[moment.kind])}</p>
          <p className="mono-celebrate-msg">{message}</p>
        </div>
        <button
          type="button"
          className="mono-celebrate-close"
          aria-label={t('mono.celebrate.close')}
          onClick={onDone}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="mono-celebrate-timer" aria-hidden />
      </div>
    </>
  );
}
