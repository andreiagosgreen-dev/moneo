import { useEffect, useState, type CSSProperties } from 'react';
import MonoHead from './MonoHead';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoTick from './MonoTick';
import MonoStat from './MonoStat';
import MonoPath from './MonoPath';
import MonoCoach from './MonoCoach';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { fmtClock, type Mode } from '../lib/store';
import { postSessionLine } from '../lib/ai/coach';
import type { SessionFeedback } from '../lib/ai/types';
import type { SessionImpact } from '../lib/progress';
import MonoProgressMeter from './MonoProgressMeter';
import { dayLabel } from './monoDate';
import { ATMOSPHERES, type Atmosphere } from './atmosphere';
import type { MonoTab } from './MonoNav';
import { pickProgramCoach } from '../lib/guidance/programCoach';

const CIRC = 540.35;
const PRESETS = [5, 25, 45];

const ATM_LABEL: Record<Atmosphere, TKey> = {
  hartie: 'mono.atm.hartie',
  sanctuar: 'mono.atm.sanctuar',
  clar: 'mono.atm.clar',
  ritual: 'mono.atm.ritual',
  zori: 'mono.atm.zori',
  atelier: 'mono.atm.atelier',
  capitol: 'mono.atm.capitol',
  tarm: 'mono.atm.tarm',
  noapte: 'mono.atm.noapte',
  ceara: 'mono.atm.ceara',
  zapada: 'mono.atm.zapada',
  carbune: 'mono.atm.carbune',
  gradina: 'mono.atm.gradina',
  ceramica: 'mono.atm.ceramica',
  cerneala: 'mono.atm.cerneala',
  aurora: 'mono.atm.aurora',
  piatra: 'mono.atm.piatra',
  miere: 'mono.atm.miere',
  mare: 'mono.atm.mare',
  lampa: 'mono.atm.lampa',
};

const BREAK_LABEL: Record<Exclude<Mode, 'focus'>, TKey> = {
  short: 'timer.mode.short.label',
  long: 'timer.mode.long.label',
};

const FEEDBACK_KINDS = ['done', 'continue', 'blocked', 'misestimated'] as const;

export interface MonoFocusTask {
  id: string;
  title: string;
  meta: string;
  done: boolean;
}

export interface MonoFocusSummary {
  id: number;
  minutes: number;
  /** Progress payoff computed at completion; absent when nothing links. */
  impact?: SessionImpact | null;
}

interface Props {
  mode: Mode;
  running: boolean;
  remaining: number;
  total: number;
  focusMin: number;
  intention: string;
  onIntention: (v: string) => void;
  onIntentionEnter: () => void;
  areas: Array<{ id: string; name: string }>;
  selectedAreaId: string | null;
  onSelectArea: (id: string | null) => void;
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  tasks: Array<{ id: string; title: string }>;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  stats: { sessions: number; focusMin: number; done: number };
  upNext: MonoFocusTask[];
  summary: MonoFocusSummary | null;
  onDismissSummary: () => void;
  estimatePomodoros?: number;
  taskTitle?: string;
  onFeedback?: (kind: SessionFeedback, estimated: number, actual: number) => void;
  onToggle: () => void;
  onReset: () => void;
  onPreset: (min: number) => void;
  onToggleTask: (id: string) => void;
  onSeePlan: () => void;
  /** Path map navigation. */
  onPath?: (tab: MonoTab) => void;
  /** Calendar day key for coach dismiss. */
  dayKey?: string;
  /** Today's plan size (for coach). */
  planTaskCount?: number;
  planOpenCount?: number;
  /** Emotional skin. Defaults to Hârtie so existing screens stay the home. */
  atmosphere?: Atmosphere;
  onAtmosphere?: (atmosphere: Atmosphere) => void;
}

/** Focus screen — one shared layout for every atmosphere; only colors change. */
export default function MonoFocus({
  mode,
  running,
  remaining,
  total,
  focusMin,
  intention,
  onIntention,
  onIntentionEnter,
  areas,
  selectedAreaId,
  onSelectArea,
  projects,
  selectedProjectId,
  onSelectProject,
  tasks,
  selectedTaskId,
  onSelectTask,
  stats,
  upNext,
  summary,
  onDismissSummary,
  estimatePomodoros,
  taskTitle,
  onFeedback,
  onToggle,
  onReset,
  onPreset,
  onToggleTask,
  onSeePlan,
  onPath,
  dayKey,
  planTaskCount,
  planOpenCount,
  atmosphere = 'hartie',
  onAtmosphere,
}: Props) {
  const { t, tag, fmtDur, fmtNum } = useI18n();
  const { mm, ss } = fmtClock(Math.max(0, remaining));
  const ratio = total > 0 ? 1 - Math.max(0, remaining) / total : 0;

  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const [coachKind, setCoachKind] = useState<SessionFeedback | null>(null);

  useEffect(() => {
    setFeedbackFor(null);
    setCoachKind(null);
    if (!summary) return;
    const id = window.setTimeout(onDismissSummary, 10_000);
    return () => window.clearTimeout(id);
  }, [summary, onDismissSummary]);

  const isBreak = mode !== 'focus';
  const title = isBreak
    ? t(BREAK_LABEL[mode])
    : running
      ? t('mono.focus.running')
      : remaining < total
        ? t('mono.focus.paused')
        : t('mono.focus.new');
  const startLabel = running
    ? t('mono.focus.pause')
    : remaining < total
      ? t('mono.focus.resume')
      : t('mono.focus.start');
  const resetDisabled = remaining >= total && !running;

  const ring = (
    <div className="atm-ring-wrap">
      <svg className="atm-ring" viewBox="0 0 200 200" aria-hidden>
        <circle className="track" cx="100" cy="100" r="86" fill="none" strokeWidth="2.25" />
        <circle
          className="bar"
          cx="100"
          cy="100"
          r="86"
          fill="none"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={Number((CIRC * ratio).toFixed(2))}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="atm-ring-readout">
        <div className="atm-time" aria-live="polite">
          {mm}:{ss}
        </div>
      </div>
    </div>
  );

  const presets = (
    <div className="atm-presets" role="group" aria-label={t('mono.focus.secToday')}>
      {PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          className="atm-preset"
          aria-pressed={focusMin === m && mode === 'focus'}
          disabled={running}
          onClick={() => onPreset(m)}
        >
          {m} {t('set.unit.min')}
        </button>
      ))}
    </div>
  );

  const intentionField = (
    <input
      id="mono-intent"
      className="mono-field atm-intent"
      type="text"
      value={intention}
      placeholder={t('mono.focus.intentPh')}
      aria-label={t('mono.focus.intentLabel')}
      autoComplete="off"
      onChange={(e) => onIntention(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onIntentionEnter();
      }}
    />
  );

  const context = (
    <details className="atm-context">
      <summary>{t('mono.atm.context')}</summary>
      <div className="atm-context-body">
        <div className="atm-context-field">
          <label className="mono-eyebrow" htmlFor="mono-area">
            {t('timer.area')}
          </label>
          <select
            id="mono-area"
            className="mono-field"
            value={selectedAreaId ?? ''}
            onChange={(e) => onSelectArea(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">{t('timer.noArea')}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="atm-context-field">
          <label className="mono-eyebrow" htmlFor="mono-project">
            {t('timer.project')}
          </label>
          <select
            id="mono-project"
            className="mono-field"
            value={selectedProjectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">{t('timer.noProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="atm-context-field">
          <label className="mono-eyebrow" htmlFor="mono-task">
            {t('timer.task')}
          </label>
          <select
            id="mono-task"
            className="mono-field"
            value={selectedTaskId ?? ''}
            onChange={(e) => onSelectTask(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">{t('timer.noTask')}</option>
            {tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </details>
  );

  const taskList =
    upNext.length === 0 ? (
      <div style={{ marginTop: 8 }}>
        <p className="atm-hint">{t('mono.focus.planEmpty')}</p>
        <div style={{ marginTop: 10 }}>
          <MonoBtn type="button" variant="primary" onClick={onSeePlan} block>
            {t('mono.focus.writePlan')}
          </MonoBtn>
        </div>
      </div>
    ) : (
      <ul className="atm-tasks">
        {upNext.map((item) => (
          <li key={item.id} className={item.done ? 'is-done' : undefined}>
            <MonoTick
              checked={item.done}
              onToggle={() => onToggleTask(item.id)}
              label={item.title}
            />
            <span>{item.title}</span>
          </li>
        ))}
      </ul>
    );

  const programCoachKind =
    dayKey != null
      ? pickProgramCoach({
          screen: 'focus',
          planTaskCount: planTaskCount ?? upNext.length,
          planOpenCount: planOpenCount ?? upNext.filter((x) => !x.done).length,
          hasBlocks: false,
        })
      : null;

  const programCoach =
    programCoachKind && dayKey ? (
      <MonoCoach
        kind={programCoachKind}
        dayKey={dayKey}
        onExample={programCoachKind === 'focusOpen' ? (text) => onIntention(text) : undefined}
        onCta={programCoachKind === 'focusEmpty' ? onSeePlan : undefined}
        ctaLabel={programCoachKind === 'focusEmpty' ? t('mono.focus.writePlan') : undefined}
      />
    ) : null;

  // Single shared composition for ALL atmospheres (colors via CSS tokens only).
  return (
    <div className={`atm atm-${atmosphere}`}>
      <details className="atm-picker">
        <summary>
          {t('mono.atm.label')} · {t(ATM_LABEL[atmosphere])}
        </summary>
        <div className="atm-switch" role="radiogroup" aria-label={t('mono.atm.label')}>
          {ATMOSPHERES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={atmosphere === id}
              onClick={() => onAtmosphere?.(id)}
            >
              {t(ATM_LABEL[id])}
            </button>
          ))}
        </div>
      </details>

      <div className="atm-desk">
        <MonoHead eyebrow={dayLabel(tag)} title={t('mono.focus.greet')} sub={t('mono.focus.sub')} />
        {onPath ? <MonoPath active="focus" onGo={onPath} /> : null}
        <div className="atm-board mono-pad">
          <section className="atm-stage" aria-label={title}>
            <p className="mono-eyebrow">{title}</p>
            {ring}
            {intentionField}
            {presets}
            <div className="atm-actions">
              <MonoBtn type="button" variant="primary" onClick={onToggle}>
                {startLabel}
              </MonoBtn>
              <MonoBtn type="button" variant="ghost" onClick={onReset} disabled={resetDisabled}>
                {t('mono.atm.reset')}
              </MonoBtn>
            </div>
          </section>
          <aside className="atm-aside" aria-label={t('mono.focus.secNext')}>
            <div className="atm-aside-head">
              <p className="atm-aside-title">{t('mono.focus.secToday')}</p>
              <MonoChip onClick={onSeePlan}>{t('mono.focus.seePlan')}</MonoChip>
            </div>
            {programCoach}
            {programCoachKind === 'focusEmpty' ? null : taskList}
            <p className="atm-hint">
              {t('mono.atm.todayLine', {
                sessions: fmtNum(stats.sessions),
                dur: fmtDur(stats.focusMin),
              })}
            </p>
            <div className="mono-grid-3" style={{ marginTop: 16 }}>
              <MonoStat value={fmtNum(stats.sessions)} caption={t('mono.focus.sSessions')} />
              <MonoStat value={fmtDur(stats.focusMin)} caption={t('mono.focus.sFocus')} />
              <MonoStat value={fmtNum(stats.done)} caption={t('mono.focus.sDone')} />
            </div>
          </aside>
          {context}
        </div>
      </div>

      {summary && (
        <div role="status" className="mono-card" style={summaryStyle}>
          <p className="mono-h3">{t('timer.done.focus')}</p>
          <p className="mono-meta" style={{ marginTop: 2 }}>
            {t('timer.doneFocusDetail', { dur: fmtDur(summary.minutes) })}
          </p>
          {summary.impact && summary.impact.kind === 'project' && (
            <MonoProgressMeter impact={summary.impact} />
          )}
          {onFeedback && feedbackFor !== summary.id && (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}
              role="group"
              aria-label={t('ai.fb.aria')}
            >
              {FEEDBACK_KINDS.map((k) => (
                <MonoChip
                  key={k}
                  onClick={() => {
                    const actual = Math.max(1, Math.round(total / 25));
                    onFeedback(k, estimatePomodoros ?? actual, actual);
                    setFeedbackFor(summary.id);
                    setCoachKind(k);
                  }}
                >
                  {t(`ai.fb.${k}` as TKey)}
                </MonoChip>
              ))}
            </div>
          )}
          {feedbackFor === summary.id && (
            <p className="mono-meta" style={{ marginTop: 8 }}>
              {(() => {
                const line =
                  coachKind && taskTitle
                    ? postSessionLine({ feedback: coachKind, taskTitle })
                    : null;
                return line ? t(line.key as TKey, line.vars) : t('ai.fb.tuned');
              })()}
            </p>
          )}
          <div style={{ marginTop: 10 }}>
            <MonoChip onClick={onDismissSummary}>{t('timer.dismiss')}</MonoChip>
          </div>
        </div>
      )}
    </div>
  );
}

const summaryStyle: CSSProperties = {
  position: 'fixed',
  bottom: 96,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  width: 'min(24rem, calc(100vw - 2rem))',
};
