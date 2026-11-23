import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import MonoHead from './MonoHead';
import MonoAmbientPicker from './MonoAmbientPicker';
import type { AmbientLayer } from '../lib/ambient';
import type { EstimateResult } from '../lib/estimates';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoTick from './MonoTick';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { fmtClock, type Mode } from '../lib/store';
import { postSessionLine } from '../lib/ai/coach';
import type { SessionFeedback } from '../lib/ai/types';
import type { SessionImpact } from '../lib/progress';
import MonoProgressMeter from './MonoProgressMeter';
import { dayLabel } from './monoDate';
import { type Atmosphere } from './atmosphere';
import type { MonoTab } from './MonoNav';
import { areaLabel } from '../lib/focusAreas';
import {
  CUSTOM_FOCUS_MAX,
  CUSTOM_FOCUS_MIN,
  FOCUS_PRESETS,
  POMODORO_MIN,
  rhythmFor,
  sanitizeFocusMin,
} from '../lib/focusRhythm';
import { toggleGammaBinaural } from '../lib/personalOsEngine';

const CIRC = 540.35;
const MINI_CIRC = 113.1;
const RING_TICKS = Array.from({ length: 60 }, (_, i) => i * 6);
const WAVE_BARS = [
  0.25, 0.42, 0.68, 0.35, 0.85, 0.54, 0.95, 0.62, 0.4, 0.78, 1, 0.66, 0.88, 0.5, 0.92, 0.6, 0.38,
  0.74, 0.48, 0.3,
];
/** Three calm quick durations shown up front; the rest live inside the Custom drawer. */
const QUICK_PRESETS = [5, 25, 45] as const;
const EXTRA_PRESETS = FOCUS_PRESETS.filter(
  (m) => !(QUICK_PRESETS as readonly number[]).includes(m),
);

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
  /** Saved break lengths (paired automatically when a length is picked). */
  shortMin?: number;
  longMin?: number;
  /** Long break comes after this many focus rounds. */
  longEvery?: number;
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
  /** Path map navigation (kept optional for API compatibility). */
  onPath?: (tab: MonoTab) => void;
  /** Calendar day key (kept optional for API compatibility). */
  dayKey?: string;
  /** Today's plan size. */
  planTaskCount?: number;
  planOpenCount?: number;
  /** Color skin (picked in Settings). */
  atmosphere?: Atmosphere;
  ambient?: {
    on: boolean;
    layers: AmbientLayer[];
    isPro: boolean;
    onToggle: () => void;
    onChange: (layers: AmbientLayer[]) => void;
    wakeLock: boolean;
    onWakeLock: (on: boolean) => void;
  };
  fullscreen?: {
    active: boolean;
    supported: boolean;
    onToggle: () => void;
    rootRef?: RefObject<HTMLDivElement>;
  };
  /** Selected task's estimate vs. tracked focus; null hides the line. */
  estimate?: EstimateResult | null;
  /** Quick add task directly from the Focus Card B (Today Priorities). */
  onQuickAdd?: (text: string) => boolean | void;
  /** Card A (Top-Right Bento): 3-Ring Personal OS HUD + 14D Transformation Chart. */
  bentoTop?: ReactNode;
  /** Workout and habit activity. */
  bentoBottom?: ReactNode;
}

function MiniGauge({ value, caption, pct }: { value: string; caption: string; pct: number }) {
  const clamped = Math.max(0.06, Math.min(1, pct));
  return (
    <div className="atm-gauge">
      <div className="atm-gauge-ring" aria-hidden="true">
        <svg viewBox="0 0 44 44">
          <circle className="atm-gauge-track" cx="22" cy="22" r="18" />
          <circle
            className="atm-gauge-bar"
            cx="22"
            cy="22"
            r="18"
            strokeDasharray={MINI_CIRC}
            strokeDashoffset={Number((MINI_CIRC * (1 - clamped)).toFixed(2))}
            transform="rotate(-90 22 22)"
          />
        </svg>
        <span className="atm-gauge-val">{value}</span>
      </div>
      <span className="atm-gauge-cap">{caption}</span>
    </div>
  );
}

/** Visual-first Focus Cockpit — one crystal-clear centerpiece, minimal text. */
export default function MonoFocus({
  mode,
  running,
  remaining,
  total,
  focusMin,
  shortMin,
  longMin,
  longEvery = 4,
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
  atmosphere = 'hartie',
  ambient,
  fullscreen,
  estimate,
  onQuickAdd,
  bentoTop,
  bentoBottom,
}: Props) {
  const { t, tag, fmtDur, fmtNum } = useI18n();
  const { mm, ss } = fmtClock(Math.max(0, remaining));
  const ratio = total > 0 ? 1 - Math.max(0, remaining) / total : 0;

  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const [coachKind, setCoachKind] = useState<SessionFeedback | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [gammaOn, setGammaOn] = useState(false);
  const [quickTaskDraft, setQuickTaskDraft] = useState('');
  const zen = fullscreen?.active === true;
  const minLabel = (n: number) => `${fmtNum(n)} ${t('set.unit.min')}`;

  useEffect(() => {
    return () => {
      toggleGammaBinaural(false);
    };
  }, []);

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

  const ringClass = ['atm-ring-wrap', running ? 'is-running' : '', summary ? 'is-bloom' : '']
    .filter(Boolean)
    .join(' ');
  const progressAngle = (1 - ratio) * 2 * Math.PI - Math.PI / 2;
  const beaconX = Number((100 + 86 * Math.cos(progressAngle)).toFixed(2));
  const beaconY = Number((100 + 86 * Math.sin(progressAngle)).toFixed(2));

  const ring = (controls?: ReactNode) => (
    <div className={ringClass}>
      {/* Concept 3: Iridescent 3D Aurora Glass Orb Core */}
      <div className="atm-ring-core-glow" aria-hidden="true" />
      <div className="atm-aurora-orb" aria-hidden="true" />
      <svg className="atm-ring" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <linearGradient id="atm-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="atm-reactor-grad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="atm-bezel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="50%" stopColor="rgba(15,23,42,0.65)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.2)" />
          </linearGradient>
          <radialGradient id="atm-core-fill" cx="42%" cy="36%" r="60%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="48%" stopColor="#a855f7" stopOpacity="0.14" />
            <stop offset="78%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Concept 2: Recessed dark titanium hardware bezel */}
        <circle
          className="atm-titanium-bezel"
          cx="100"
          cy="100"
          r="97.5"
          fill="none"
          stroke="url(#atm-bezel-grad)"
          strokeWidth="2.2"
        />

        {/* Concept 1: Outer rotating orbital reticle */}
        <circle
          className="atm-orbit-outer"
          cx="100"
          cy="100"
          r="94.5"
          fill="none"
          strokeWidth="1"
          strokeDasharray="6 10 2 10"
        />

        {/* 60-tick dual-tone precision chronograph bezel */}
        <g className="ticks">
          {RING_TICKS.map((deg) => {
            const major = deg % 30 === 0;
            const cardinal = deg % 90 === 0;
            const warm = deg >= 90 && deg <= 270;
            return (
              <line
                key={deg}
                className={
                  cardinal
                    ? 'is-cardinal'
                    : major
                      ? warm
                        ? 'is-major is-warm'
                        : 'is-major'
                      : warm
                        ? 'is-warm'
                        : undefined
                }
                x1="100"
                y1="5.5"
                x2="100"
                y2={cardinal ? '13.5' : major ? '10.5' : '8'}
                transform={`rotate(${deg} 100 100)`}
              />
            );
          })}
        </g>

        {/* Main progress track & dual-tone cyan-to-gold arc */}
        <circle className="track" cx="100" cy="100" r="86" fill="none" strokeWidth="4.5" />
        <circle
          className="bar"
          cx="100"
          cy="100"
          r="86"
          fill="none"
          stroke="url(#atm-ring-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={Number((CIRC * ratio).toFixed(2))}
          transform="rotate(-90 100 100)"
        />

        {/* Counter-rotating J.A.R.V.I.S. inner segmented reactor rings */}
        <circle
          className="atm-orbit-mid"
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke="url(#atm-reactor-grad)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="44 18 14 18 68 24"
        />
        <circle
          className="atm-orbit-inner"
          cx="100"
          cy="100"
          r="61"
          fill="url(#atm-core-fill)"
          stroke="url(#atm-ring-grad)"
          strokeWidth="1.2"
          strokeDasharray="18 12"
        />

        <circle className="beacon-halo" cx={beaconX} cy={beaconY} r="10" />
        <circle className="beacon" cx={beaconX} cy={beaconY} r="4.5" />
      </svg>
      <div className="atm-ring-readout">
        <span className={`atm-status-pill${running ? ' is-live' : ''}`} role="status">
          {title}
        </span>
        <div className="atm-time" role="timer">
          {mm}:{ss}
        </div>
        {/* Concept 4: Cyber-Athletic live focus waveform visualizer */}
        <div className={`atm-waveform${running ? ' is-live' : ''}`} aria-hidden="true">
          {WAVE_BARS.map((h, idx) => (
            <span
              key={idx}
              style={{
                height: `${Math.round(h * 18)}px`,
                animationDelay: `${(idx * 70) % 700}ms`,
              }}
            />
          ))}
        </div>
        {controls}
      </div>
    </div>
  );

  const paired = rhythmFor(focusMin);
  const breakShort = shortMin ?? paired.shortMin;
  const breakLong = longMin ?? paired.longMin;
  const customOn = mode === 'focus' && !(QUICK_PRESETS as readonly number[]).includes(focusMin);
  const applyCustom = () => {
    const min = sanitizeFocusMin(customDraft);
    if (min === null) return;
    onPreset(min);
    setCustomOpen(false);
    setCustomDraft('');
  };

  const presets = (
    <div className="atm-presets" role="group" aria-label={t('mono.focus.lengthLabel')}>
      {QUICK_PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          className="atm-preset"
          aria-pressed={focusMin === m && mode === 'focus'}
          aria-label={minLabel(m)}
          title={m === POMODORO_MIN ? t('mono.focus.pomodoroClassic') : undefined}
          disabled={running}
          onClick={() => onPreset(m)}
        >
          {minLabel(m)}
        </button>
      ))}
      <button
        type="button"
        className="atm-preset"
        aria-pressed={customOn}
        aria-expanded={customOpen}
        disabled={running}
        onClick={() => setCustomOpen((o) => !o)}
      >
        {customOn ? minLabel(focusMin) : t('mono.focus.custom')}
      </button>
    </div>
  );

  const customPanel =
    customOpen && !running ? (
      <div className="atm-custom-pop">
        <div className="atm-presets atm-presets-extra">
          {EXTRA_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className="atm-preset"
              aria-pressed={focusMin === m && mode === 'focus'}
              aria-label={minLabel(m)}
              onClick={() => {
                onPreset(m);
                setCustomOpen(false);
              }}
            >
              {minLabel(m)}
            </button>
          ))}
        </div>
        <form
          className="atm-custom"
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
        >
          <label htmlFor="mono-focus-custom" className="mono-meta">
            {t('mono.focus.customLabel', {
              min: fmtNum(CUSTOM_FOCUS_MIN),
              max: fmtNum(CUSTOM_FOCUS_MAX),
            })}
          </label>
          <div className="mono-row" style={{ gap: 8 }}>
            <input
              id="mono-focus-custom"
              className="mono-field"
              type="number"
              inputMode="numeric"
              min={CUSTOM_FOCUS_MIN}
              max={CUSTOM_FOCUS_MAX}
              step={1}
              value={customDraft}
              placeholder={fmtNum(focusMin)}
              onChange={(e) => setCustomDraft(e.target.value)}
              style={{ flex: 1 }}
            />
            <MonoBtn type="submit" disabled={sanitizeFocusMin(customDraft) === null}>
              {t('mono.focus.customSet')}
            </MonoBtn>
          </div>
        </form>
        <p className="mono-meta atm-rhythm-hint">
          {t('mono.focus.rhythmHint', {
            focus: minLabel(focusMin),
            short: minLabel(breakShort),
            long: minLabel(breakLong),
            every: fmtNum(longEvery),
          })}
        </p>
      </div>
    ) : null;

  const intentionField = (
    <input
      id="mono-intent"
      className="mono-field atm-intent mono-ph-fit"
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

  const activeProjectName = projects.find((p) => p.id === selectedProjectId)?.name;

  const context = (
    <details className="atm-context atm-context-inline">
      <summary>{activeProjectName ?? t('mono.atm.context')}</summary>
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
                {areaLabel(a, t)}
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
      <div className="atm-empty-plan">
        <p className="atm-hint">{t('mono.focus.planEmpty')}</p>
        <MonoBtn type="button" variant="ghost" onClick={onSeePlan} block>
          {t('mono.focus.writePlan')}
        </MonoBtn>
      </div>
    ) : (
      <ul className="atm-tasks">
        {upNext.map((item, idx) => {
          const isCurrent =
            !item.done &&
            (intention.trim() === item.title.trim() ||
              (intention.trim() === '' && idx === upNext.findIndex((u) => !u.done)));
          const badgeText = item.done ? 'DONE' : isCurrent ? 'ACTIVE' : 'NEXT';
          const badgeClass = item.done ? 'is-done' : isCurrent ? 'is-active' : 'is-next';
          return (
            <li
              key={item.id}
              className={`${item.done ? 'is-done' : ''}${isCurrent ? ' is-current' : ''}`}
            >
              <span className={`atm-task-accent ${badgeClass}`} aria-hidden="true" />
              <MonoTick
                checked={item.done}
                onToggle={() => onToggleTask(item.id)}
                label={item.title}
              />
              <button
                type="button"
                className="atm-task-pick"
                onClick={() => {
                  if (!item.done) onIntention(item.title);
                }}
              >
                <span>{item.title}</span>
              </button>
              <span className={`atm-task-badge ${badgeClass}`}>{badgeText}</span>
              {!item.done && (
                <button
                  type="button"
                  className="atm-task-play"
                  aria-label={`${t('mono.focus.start')}: ${item.title}`}
                  title={`${t('mono.focus.start')}: ${item.title}`}
                  onClick={() => {
                    onIntention(item.title);
                    if (!running) onToggle();
                  }}
                >
                  ▶
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );

  const estimateLine = estimate ? (
    <p className="atm-hint atm-est" data-testid="focus-estimate">
      {t('mono.focus.est', {
        est: minLabel(estimate.estimateMin),
        act: minLabel(estimate.actualMin),
      })}
    </p>
  ) : null;

  const tools = (
    <div className="atm-tools">
      <button
        type="button"
        className="mono-chip atm-tool"
        aria-pressed={gammaOn}
        title="40Hz Gamma Binaural Focus Shield (200Hz L / 240Hz R)"
        onClick={() => setGammaOn(toggleGammaBinaural(!gammaOn))}
        data-testid="gamma-40hz-btn"
      >
        <span aria-hidden>⚡</span> 40Hz Gamma
      </button>
      {ambient ? (
        <>
          <button
            type="button"
            className="mono-chip atm-tool"
            aria-pressed={ambient.on}
            title={ambient.on ? t('mono.focus.soundOn') : t('mono.focus.soundOff')}
            onClick={ambient.onToggle}
          >
            <span aria-hidden>♪</span> {t('mono.focus.sound')}
          </button>
          <button
            type="button"
            className="mono-chip atm-tool"
            aria-expanded={pickerOpen}
            aria-controls="atm-amb-pop"
            onClick={() => setPickerOpen((v) => !v)}
          >
            {t('mono.focus.amb.choose')} <span aria-hidden>{pickerOpen ? '▴' : '▾'}</span>
          </button>
        </>
      ) : null}
      {fullscreen ? (
        <button
          type="button"
          className="mono-chip atm-tool"
          aria-pressed={zen}
          aria-label={zen ? t('mono.focus.fullExit') : t('mono.focus.full')}
          onClick={fullscreen.onToggle}
        >
          <span aria-hidden>{zen ? '⤡' : '⤢'}</span>
        </button>
      ) : null}
    </div>
  );

  const ambientPop =
    ambient && pickerOpen ? (
      <div id="atm-amb-pop" className="atm-amb-pop">
        <MonoAmbientPicker
          layers={ambient.layers}
          isPro={ambient.isPro}
          onChange={ambient.onChange}
          wakeLock={ambient.wakeLock}
          onWakeLock={ambient.onWakeLock}
        />
      </div>
    ) : null;

  const donePct =
    upNext.length > 0 ? upNext.filter((x) => x.done).length / upNext.length : stats.done / 3;

  return (
    <div
      ref={fullscreen?.rootRef}
      className={`atm atm-cockpit atm-${atmosphere}${zen ? ' is-zen' : ''}`}
    >
      <div className="atm-desk">
        {zen ? null : (
          <MonoHead
            eyebrow={dayLabel(tag)}
            title={t(
              isBreak
                ? 'mono.focus.greetBreak'
                : running || remaining < total
                  ? 'mono.focus.greetRunning'
                  : 'mono.focus.greet',
            )}
          />
        )}
        <div className="atm-board mono-pad">
          <section className="atm-stage" aria-label={title}>
            <div className="atm-horizon-grid" aria-hidden="true" />
            {ring(zen ? undefined : presets)}
            {zen && taskTitle ? <p className="atm-zen-task">{taskTitle}</p> : null}
            {estimateLine}
            {zen ? null : customPanel}
            <div className="atm-actions">
              <MonoBtn type="button" variant="primary" className="atm-start-cta" onClick={onToggle}>
                {startLabel}
              </MonoBtn>
              {!resetDisabled ? (
                <MonoBtn type="button" variant="ghost" onClick={onReset}>
                  {t('mono.atm.reset')}
                </MonoBtn>
              ) : null}
            </div>
            {intentionField}
            {tools}
            {ambientPop}
            {zen ? null : context}
            {!zen && (
              <div className="atm-gauges">
                <MiniGauge
                  value={fmtNum(stats.sessions)}
                  caption={t('mono.focus.sSessions')}
                  pct={stats.sessions / 4}
                />
                <MiniGauge
                  value={fmtDur(stats.focusMin)}
                  caption={t('mono.focus.sFocus')}
                  pct={stats.focusMin / 120}
                />
                <MiniGauge
                  value={fmtNum(stats.done)}
                  caption={t('mono.focus.sDone')}
                  pct={donePct}
                />
              </div>
            )}
          </section>

          <div className="atm-bento-right" hidden={zen}>
            {bentoTop ? <div className="atm-bento-slot">{bentoTop}</div> : null}

            <aside className="atm-aside" aria-label={t('mono.focus.secNext')}>
              <div className="atm-aside-head">
                <p className="atm-aside-title">{t('mono.focus.secToday')}</p>
                <span className="atm-aside-ratio">
                  {fmtNum(upNext.filter((x) => x.done).length)} / {fmtNum(upNext.length)}
                  {upNext.length > 0 ? ` · ${fmtNum(Math.round(donePct * 100))}%` : ''}
                </span>
                <button type="button" className="atm-aside-link" onClick={onSeePlan}>
                  {t('mono.focus.seePlan')} →
                </button>
              </div>
              {taskList}
              {onQuickAdd && upNext.length > 0 ? (
                <form
                  className="atm-quick-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = quickTaskDraft.trim();
                    if (!clean) return;
                    if (onQuickAdd(clean) !== false) setQuickTaskDraft('');
                  }}
                >
                  <input
                    type="text"
                    className="mono-field atm-quick-input"
                    value={quickTaskDraft}
                    placeholder={t('mono.azi.addPh')}
                    onChange={(e) => setQuickTaskDraft(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="atm-quick-btn"
                    disabled={quickTaskDraft.trim().length === 0}
                    aria-label={t('mono.azi.addBtn')}
                  >
                    +
                  </button>
                </form>
              ) : null}
            </aside>

            {bentoBottom ? <div className="atm-bento-slot">{bentoBottom}</div> : null}
          </div>
        </div>
      </div>

      {summary && (
        <div role="status" className="mono-card atm-summary">
          <p className="mono-h3">{t('timer.done.focus')}</p>
          <p className="mono-meta" style={{ marginTop: 2 }}>
            {t('timer.doneFocusDetail', { dur: fmtDur(summary.minutes) })}
          </p>
          {summary.impact && summary.impact.kind === 'project' && (
            <MonoProgressMeter impact={summary.impact} />
          )}
          {estimate ? (
            <p className="mono-meta" style={{ marginTop: 6 }}>
              {t(`mono.focus.est.${estimate.verdict}` as TKey)}
            </p>
          ) : null}
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
