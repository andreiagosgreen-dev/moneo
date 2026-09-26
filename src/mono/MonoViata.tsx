import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { MonoTab } from './MonoNav';
import type { Motto } from '../lib/guidance/mottos';
import type { LifeFrame, LifeNextStep } from '../lib/guidance/lifeProgress';
import MonoHead from './MonoHead';
import MonoPath from './MonoPath';
import MonoBtn from './MonoBtn';
import MonoCard from './MonoCard';
import type { TKey } from '../lib/i18n/types';

const FRAME_LABEL: Record<LifeFrame['id'], TKey> = {
  today: 'mono.life.frame.today',
  focus: 'mono.life.frame.focus',
  projects: 'mono.life.frame.projects',
  life: 'mono.life.frame.life',
};

const NEXT_KEY: Record<LifeNextStep['kind'], TKey> = {
  writePlan: 'mono.life.next.writePlan',
  workFocus: 'mono.life.next.workFocus',
  tuneMap: 'mono.life.next.tuneMap',
  keepRhythm: 'mono.life.next.keepRhythm',
};

const NEXT_CTA: Record<LifeNextStep['kind'], TKey> = {
  writePlan: 'mono.life.cta.writePlan',
  workFocus: 'mono.life.cta.workFocus',
  tuneMap: 'mono.life.cta.tuneMap',
  keepRhythm: 'mono.life.cta.keepRhythm',
};

const HORIZONS: Array<{ id: string; label: TKey; tab?: MonoTab }> = [
  { id: 'day', label: 'horizon.day', tab: 'today' },
  { id: 'week', label: 'horizon.week', tab: 'reports' },
  { id: 'year', label: 'horizon.year1', tab: 'plan' },
  { id: 'life', label: 'horizon.life' },
];

interface Props {
  motto: Motto;
  frames: LifeFrame[];
  next: LifeNextStep;
  onGo: (tab: MonoTab) => void;
  children?: ReactNode;
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const v = Math.min(100, Math.max(0, Math.round(pct)));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  return (
    <div className="mono-life-ring" aria-label={`${label}: ${v}%`}>
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden>
        <circle className="mono-life-ring-track" cx="36" cy="36" r={r} fill="none" strokeWidth="5" />
        <circle
          className="mono-life-ring-bar"
          cx="36"
          cy="36"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className="mono-life-ring-pct mono-num">{v}%</span>
    </div>
  );
}

/** Life hub: motto, horizons, progress frames, next step, then Life Map detail. */
export default function MonoViata({ motto, frames, next, onGo, children }: Props) {
  const { t, fmtDur } = useI18n();

  return (
    <div>
      <MonoHead eyebrow={t('mono.life.kicker')} title={t('mono.life.title')} sub={t('mono.life.sub')} />
      <MonoPath active="map" onGo={onGo} withLife />

      <div className="mono-pad">
        <div className="mono-card mono-life-motto">
          <p className="mono-eyebrow">{t('mono.life.mottoLabel')}</p>
          <p className="mono-life-motto-text">“{motto.text}”</p>
          <p className="mono-meta" style={{ marginTop: 6 }}>
            — {motto.source}
          </p>
        </div>
      </div>

      <div className="mono-pad" style={{ marginTop: 14 }}>
        <p className="mono-eyebrow" style={{ marginBottom: 8 }}>
          {t('horizon.title')}
        </p>
        <div className="mono-life-horizons" role="group" aria-label={t('horizon.title')}>
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`mono-life-horizon${h.id === 'life' ? ' is-on' : ''}`}
              onClick={() => h.tab && onGo(h.tab)}
              disabled={!h.tab}
            >
              {t(h.label)}
            </button>
          ))}
        </div>
      </div>

      <section className="mono-sec mono-pad" aria-label={t('mono.life.frames')}>
        <p className="mono-eyebrow" style={{ marginBottom: 8 }}>
          {t('mono.life.frames')}
        </p>
        <div className="mono-life-frames">
          {frames.map((f) => (
            <button
              key={f.id}
              type="button"
              className="mono-life-frame"
              onClick={() => onGo(f.tab)}
            >
              <Ring pct={f.pct} label={t(FRAME_LABEL[f.id])} />
              <span className="mono-life-frame-label">{t(FRAME_LABEL[f.id])}</span>
              {f.id === 'focus' && typeof f.meta === 'number' ? (
                <span className="mono-meta">{fmtDur(f.meta)}</span>
              ) : (
                <span className="mono-meta">{t('mono.life.open')}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      <div className="mono-pad" style={{ marginTop: 8 }}>
        <MonoCard>
          <p className="mono-eyebrow">{t('mono.life.nextLabel')}</p>
          <p className="mono-h3" style={{ marginTop: 6 }}>
            {t(NEXT_KEY[next.kind])}
          </p>
          <div style={{ marginTop: 12 }}>
            <MonoBtn variant="primary" onClick={() => onGo(next.tab)} block>
              {t(NEXT_CTA[next.kind])}
            </MonoBtn>
          </div>
        </MonoCard>
      </div>

      {children ? <div className="mono-sec mono-pad">{children}</div> : null}
    </div>
  );
}
