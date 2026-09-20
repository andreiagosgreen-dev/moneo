import { useEffect, useRef, useState } from 'react';
import { fmtClock, type Mode, type Settings } from '../lib/store';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { postSessionLine } from '../lib/ai/coach';
import type { SessionFeedback } from '../lib/ai/types';
import { AREA_NAME_MAX, MAX_AREAS, type FocusArea } from '../lib/focusAreas';
import { tasksForProject, type Task } from '../lib/tasks';

const MODES: Mode[] = ['focus', 'short', 'long'];

/** Translated mode meta (Faza 5) — replaces the English-only MODE_META. */
const MODE_KEYS: Record<Mode, { label: TKey; short: TKey; tagline: TKey }> = {
  focus: {
    label: 'timer.mode.focus.label',
    short: 'timer.mode.focus.short',
    tagline: 'timer.mode.focus.tagline',
  },
  short: {
    label: 'timer.mode.short.label',
    short: 'timer.mode.short.short',
    tagline: 'timer.mode.short.tagline',
  },
  long: {
    label: 'timer.mode.long.label',
    short: 'timer.mode.long.short',
    tagline: 'timer.mode.long.tagline',
  },
};

interface Props {
  mode: Mode;
  running: boolean;
  remaining: number;
  total: number;
  cycle: number;
  settings: Settings;
  flashKey: number;
  onModeChange: (m: Mode) => void;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  intentionDraft: string;
  onIntentionDraftChange: (v: string) => void;
  onIntentionEnter: () => void;
  areas: FocusArea[];
  selectedAreaId: string | null;
  onSelectArea: (id: string | null) => void;
  onCreateArea: (name: string) => boolean;
  onRenameArea: (id: string, name: string) => boolean;
  onDeleteArea: (id: string) => void;
  projects: Array<{ id: string; name: string; color: string }>;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  /** Faza 6 estimate learner: base guess in Pomodoros + feedback sink. */
  estimatePomodoros?: number;
  taskTitle?: string;
  onFeedback?: (kind: SessionFeedback, estimated: number, actual: number) => void;
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5c0-1.2 1.3-1.9 2.3-1.3l10 6.5c1 .6 1 2 0 2.6l-10 6.5c-1 .6-2.3-.1-2.3-1.3v-13z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4.4" height="16" rx="1.6" />
      <rect x="13.6" y="4" width="4.4" height="16" rx="1.6" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function SkipIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4l10 8-10 8V4z" fill="currentColor" stroke="none" />
      <path d="M19 5v14" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function TimerCard({
  mode,
  running,
  remaining,
  total,
  cycle,
  settings,
  flashKey,
  onModeChange,
  onToggle,
  onReset,
  onSkip,
  intentionDraft,
  onIntentionDraftChange,
  onIntentionEnter,
  areas,
  selectedAreaId,
  onSelectArea,
  onCreateArea,
  onRenameArea,
  onDeleteArea,
  projects,
  selectedProjectId,
  onSelectProject,
  tasks,
  selectedTaskId,
  onSelectTask,
  estimatePomodoros,
  taskTitle,
  onFeedback,
}: Props) {
  const { mm, ss } = fmtClock(remaining);
  const { t, fmtDur } = useI18n();
  const progress = total > 0 ? remaining / total : 0;
  const meta = {
    label: t(MODE_KEYS[mode].label),
    short: t(MODE_KEYS[mode].short),
    tagline: t(MODE_KEYS[mode].tagline),
  };
  const activeIdx = MODES.indexOf(mode);
  const started = running || remaining < total;

  const projectTasks = selectedProjectId ? tasksForProject(tasks, selectedProjectId) : [];

  const statusLabel = running
    ? t('timer.status.in')
    : started
      ? t('timer.status.paused')
      : t('timer.status.ready');

  /* ---------- focus area management (local UI state only) ---------- */
  const [areaOpen, setAreaOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [areaNote, setAreaNote] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (areaOpen && addRef.current) addRef.current.focus();
  }, [areaOpen]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  /* ---------- 10-second completion summary (Faza 4) ----------
   * flashKey bumps once per completed session (sound + notification already
   * fire in useTimer). Only the finished kind + minutes are stored; the
   * text renders through t() so a mid-summary language switch still works. */
  const [summary, setSummary] = useState<null | {
    id: number;
    kind: 'focus' | 'break';
    minutes: number;
  }>(null);
  const latestSession = useRef({ mode, total });
  const firstFlash = useRef(true);
  const [feedbackFor, setFeedbackFor] = useState<number | null>(null);
  const [coachKind, setCoachKind] = useState<SessionFeedback | null>(null);
  useEffect(() => {
    if (firstFlash.current) {
      firstFlash.current = false;
      latestSession.current = { mode, total };
      return;
    }
    const done = latestSession.current;
    latestSession.current = { mode, total };
    const id = flashKey;
    setSummary({
      id,
      kind: done.mode === 'focus' ? 'focus' : 'break',
      minutes: done.total,
    });
    setFeedbackFor(null);
    setCoachKind(null);
    const timer = window.setTimeout(() => {
      setSummary((s) => (s && s.id === id ? null : s));
    }, 10000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashKey]);

  const submitNewArea = () => {
    const ok = onCreateArea(newName);
    if (ok) {
      setNewName('');
      setAreaNote('');
    } else {
      setAreaNote(
        newName.trim().length === 0
          ? t('timer.areaEmpty')
          : t('timer.areaFull', { max: MAX_AREAS }),
      );
    }
  };

  const submitRename = (id: string) => {
    if (onRenameArea(id, editName)) {
      setEditingId(null);
      setEditName('');
    }
  };

  const iconBtn = 'press btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg';

  return (
    <section
      className={`card px-4 pb-8 pt-6 sm:px-10 sm:pb-10 ${running ? 'focus-hero' : ''}`}
      aria-label="Timer"
    >
      {/* mode switcher */}
      <div
        className="relative grid grid-cols-3 rounded-full border border-line bg-ink/60 p-1"
        role="tablist"
        aria-label={t('timer.modeLabel')}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full border transition-all duration-300 ease-out"
          style={{
            transform: `translateX(${activeIdx * 100}%)`,
            background: 'rgb(var(--accent-rgb) / 0.13)',
            borderColor: 'rgb(var(--accent-rgb) / 0.35)',
          }}
        />
        {MODES.map((m) => {
          const active = m === mode;
          const mins =
            m === 'focus'
              ? settings.focusMin
              : m === 'short'
                ? settings.shortMin
                : settings.longMin;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(m)}
              className={`press relative z-10 flex items-center justify-center gap-2 rounded-full px-2 py-2.5 font-display text-sm font-semibold tracking-wide sm:text-[15px] ${
                active ? 'text-cream' : 'text-faint hover:text-sage'
              }`}
            >
              {t(MODE_KEYS[m].short)}
              <span
                className={`hidden font-mono text-[11px] font-medium sm:inline ${
                  active ? 'opacity-80' : 'opacity-60'
                }`}
                style={active ? { color: 'var(--accent)' } : undefined}
              >
                {mins}m
              </span>
            </button>
          );
        })}
      </div>

      {/* focus intention — optional, never blocks the timer */}
      <p className="mt-3 text-center text-[12px] text-faint">{t('timer.intentionHint')}</p>
      <div className="mt-3">
        <label
          htmlFor="focus-intention"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
        >
          {t('timer.intention')}
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id="focus-intention"
            type="text"
            maxLength={80}
            autoComplete="off"
            value={intentionDraft}
            onChange={(e) => onIntentionDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onIntentionEnter();
              }
            }}
            placeholder={t('timer.intentionPh')}
            className="h-10 w-full min-w-0 rounded-xl border border-line bg-ink/60 px-3 text-sm text-cream transition-colors placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
            style={{ caretColor: 'var(--accent)' }}
          />
          {intentionDraft.length > 0 && (
            <button
              onClick={() => onIntentionDraftChange('')}
              className="press btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              aria-label={t('timer.clearIntention')}
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* focus area selector */}
      <div className="mt-3">
        <label
          htmlFor="focus-area"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
        >
          {t('timer.area')}
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              id="focus-area"
              value={selectedAreaId ?? ''}
              onChange={(e) => onSelectArea(e.target.value || null)}
              className="h-10 w-full cursor-pointer appearance-none truncate rounded-xl border border-line bg-ink/60 pl-3 pr-8 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            >
              <option value="">{t('timer.noArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint">
              <ChevronIcon />
            </span>
          </div>
          <button
            onClick={() => setAreaOpen((o) => !o)}
            className="press btn-ghost flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 font-mono text-[12px]"
            aria-expanded={areaOpen}
            aria-label={areaOpen ? t('timer.closeAreas') : t('timer.manageAreas')}
          >
            {areaOpen ? t('timer.close') : t('timer.manage')}
          </button>
        </div>

        {/* area manager */}
        {areaOpen && (
          <div className="mt-2 rounded-xl border border-line bg-ink/50 p-3">
            {areas.length === 0 ? (
              <p className="text-[12px] text-faint">{t('timer.noAreas')}</p>
            ) : (
              <ul className="space-y-1.5">
                {areas.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    {editingId === a.id ? (
                      <>
                        <input
                          value={editName}
                          maxLength={AREA_NAME_MAX}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitRename(a.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          aria-label={t('timer.renameArea', { name: a.name })}
                          className="h-8 w-full min-w-0 rounded-lg border border-line bg-ink/60 px-2 text-[13px] text-cream focus:[border-color:var(--accent)] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => submitRename(a.id)}
                          className={iconBtn}
                          aria-label={t('timer.saveArea')}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className={iconBtn}
                          aria-label={t('timer.cancelRename')}
                        >
                          <XIcon />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-cream/90">
                          {a.name}
                          {selectedArea?.id === a.id && (
                            <span className="ml-2 font-mono text-[10px] uppercase text-faint">
                              {t('timer.selected')}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(a.id);
                            setEditName(a.name);
                          }}
                          className={iconBtn}
                          aria-label={t('timer.renameArea', { name: a.name })}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => onDeleteArea(a.id)}
                          className={iconBtn}
                          aria-label={t('timer.deleteArea', { name: a.name })}
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
              <input
                ref={addRef}
                value={newName}
                maxLength={AREA_NAME_MAX}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitNewArea();
                  }
                }}
                placeholder={t('timer.newArea')}
                aria-label={t('timer.newArea')}
                className="h-8 w-full min-w-0 rounded-lg border border-line bg-ink/60 px-2 text-[13px] text-cream placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
              />
              <button
                onClick={submitNewArea}
                className={`${iconBtn} h-8`}
                aria-label={t('timer.addArea')}
              >
                <PlusIcon />
              </button>
            </div>
            {areaNote && (
              <p role="status" className="mt-1.5 text-[11px] text-faint">
                {areaNote}
              </p>
            )}
          </div>
        )}
      </div>

      {/* project selector */}
      <div className="mt-3">
        <label
          htmlFor="project"
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
        >
          {t('timer.project')}
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              id="project"
              value={selectedProjectId ?? ''}
              onChange={(e) => onSelectProject(e.target.value || null)}
              className="h-10 w-full cursor-pointer appearance-none truncate rounded-xl border border-line bg-ink/60 pl-3 pr-8 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
            >
              <option value="">{t('timer.noProject')}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint">
              <ChevronIcon />
            </span>
          </div>
        </div>
      </div>

      {/* task selector (only when a project is selected) */}
      {selectedProjectId && projectTasks.length > 0 && (
        <div className="mt-3">
          <label
            htmlFor="task"
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
          >
            {t('timer.task')}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <select
                id="task"
                value={selectedTaskId ?? ''}
                onChange={(e) => onSelectTask(e.target.value || null)}
                className="h-10 w-full cursor-pointer appearance-none truncate rounded-xl border border-line bg-ink/60 pl-3 pr-8 text-sm text-cream transition-colors focus:[border-color:var(--accent)] focus:outline-none"
              >
                <option value="">{t('timer.noTask')}</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint">
                <ChevronIcon />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ring + digits */}
      <div key={flashKey} className={`pop relative mx-auto mt-6 max-w-[400px] sm:mt-8`}>
        <svg
          viewBox="0 0 400 400"
          className="w-full"
          role="img"
          aria-label={t('timer.ringAria', { label: meta.label, time: `${mm}:${ss}` })}
        >
          <defs>
            <filter id="ringGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* track */}
          <circle
            cx="200"
            cy="200"
            r="178"
            fill="none"
            stroke="rgb(242 244 249 / 0.07)"
            strokeWidth="10"
          />
          {/* inner hairline guide */}
          <circle
            cx="200"
            cy="200"
            r="146"
            fill="none"
            stroke="rgb(242 244 249 / 0.05)"
            strokeWidth="1"
          />
          {/* clock-face ticks, quarters emphasized */}
          {Array.from({ length: 12 }).map((_, i) => {
            const deg = i * 30;
            const quarter = i % 3 === 0;
            return (
              <line
                key={deg}
                x1="200"
                y1={quarter ? 34 : 38}
                x2="200"
                y2="48"
                stroke={quarter ? 'rgb(242 244 249 / 0.18)' : 'rgb(242 244 249 / 0.09)'}
                strokeWidth={quarter ? 3 : 2}
                strokeLinecap="round"
                transform={`rotate(${deg} 200 200)`}
              />
            );
          })}
          {/* luminous breathing arc — opacity only, while running */}
          {running && (
            <circle
              cx="200"
              cy="200"
              r="178"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="18"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100 - progress * 100}
              transform="rotate(-90 200 200)"
              filter="url(#ringGlow)"
              className="arc-breathe"
              aria-hidden
            />
          )}
          {/* progress */}
          <circle
            cx="200"
            cy="200"
            r="178"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - progress * 100}
            transform="rotate(-90 200 200)"
            filter="url(#ringGlow)"
            style={{
              transition: 'stroke-dashoffset 0.35s linear, stroke 0.6s ease',
            }}
          />
        </svg>

        {/* centered readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--accent)' }}
          >
            <span
              className={`relative inline-block h-1.5 w-1.5 rounded-full ${running ? 'ping-dot' : ''}`}
              style={{ background: 'var(--accent)', color: 'var(--accent)' }}
            />
            {statusLabel}
          </span>
          <div className="mt-2 font-mono font-medium tabular-nums leading-none tracking-tight text-cream [font-size:clamp(4.2rem,17vw,7.5rem)]">
            {mm}
            <span className={running ? 'colon-run' : ''} style={{ opacity: 0.55 }}>
              :
            </span>
            {ss}
          </div>
          <p className="mt-3 hidden text-sm text-sage sm:block">{meta.tagline}</p>
          {mode === 'focus' && (
            <div
              className="mt-4 flex items-center gap-2"
              aria-label={t('timer.cycleAria', {
                done: cycle,
                total: settings.longEvery,
              })}
            >
              {Array.from({ length: settings.longEvery }).map((_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full transition-all duration-500"
                  style={{
                    background: i < cycle ? 'var(--accent)' : 'rgb(242 244 249 / 0.14)',
                    boxShadow: i < cycle ? '0 0 10px rgb(var(--accent-rgb) / 0.7)' : 'none',
                  }}
                />
              ))}
              <span className="ml-1 font-mono text-[11px] text-faint">
                {cycle}/{settings.longEvery}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* controls */}
      <div className="mt-7 flex items-center justify-center gap-2 sm:mt-9 sm:gap-3">
        <button
          onClick={onReset}
          className="press btn-ghost flex h-12 w-12 items-center justify-center rounded-full"
          aria-label={t('timer.reset')}
          title={`${t('timer.reset')} (R)`}
        >
          <ResetIcon />
        </button>

        <button
          onClick={onToggle}
          className="press btn-accent flex h-16 min-w-36 items-center justify-center gap-3 rounded-full px-6 font-display text-lg font-bold tracking-wide sm:min-w-44 sm:px-10"
          aria-label={running ? t('timer.pause') : started ? t('timer.resume') : t('timer.start')}
          title={
            running
              ? `${t('timer.pause')} (Space)`
              : started
                ? `${t('timer.resume')} (Space)`
                : `${t('timer.start')} (Space)`
          }
        >
          {running ? <PauseIcon /> : <PlayIcon />}
          {running ? t('timer.pause') : started ? t('timer.resume') : t('timer.start')}
        </button>

        <button
          onClick={onSkip}
          className="press btn-ghost flex h-12 w-12 items-center justify-center rounded-full"
          aria-label={t('timer.skip')}
          title={t('timer.skip')}
        >
          <SkipIcon />
        </button>
      </div>

      {/* 10-second completion summary */}
      {summary && (
        <div
          role="status"
          className={`dialog-pop glass fixed bottom-6 left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl px-5 pb-3.5 pt-4 ${
            summary.kind === 'break' ? 'accent-reflect' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-bold text-cream">
                {summary.kind === 'focus' ? t('timer.done.focus') : t('timer.done.break')}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-sage">
                {summary.kind === 'focus'
                  ? t('timer.doneFocusDetail', { dur: fmtDur(summary.minutes) })
                  : t('timer.doneBreakDetail', { dur: fmtDur(summary.minutes) })}
              </p>
              {onFeedback && feedbackFor !== summary.id && (
                <div
                  className="mt-2.5 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label={t('ai.fb.aria')}
                >
                  {(['done', 'continue', 'blocked', 'misestimated'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        const actual = Math.max(1, Math.round(total / 25));
                        onFeedback(k, estimatePomodoros ?? actual, actual);
                        setFeedbackFor(summary.id);
                        setCoachKind(k);
                      }}
                      className="press rounded-md px-2 py-1 font-mono text-[10px] text-sage ring-1 ring-inset ring-line hover:text-cream hover:ring-accent/50"
                    >
                      {t(`ai.fb.${k}` as TKey)}
                    </button>
                  ))}
                </div>
              )}
              {feedbackFor === summary.id &&
                (() => {
                  const line =
                    coachKind && taskTitle
                      ? postSessionLine({ feedback: coachKind, taskTitle })
                      : null;
                  return (
                    <p className="mt-2 text-[12px] leading-relaxed text-sage">
                      {line ? t(line.key as TKey, line.vars) : t('ai.fb.tuned')}
                    </p>
                  );
                })()}
            </div>
            <button
              onClick={() => setSummary(null)}
              className="press shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] text-faint hover:text-cream"
              aria-label={t('timer.dismiss')}
            >
              ✕
            </button>
          </div>
          <div
            className="summary-timer-bar mt-3 h-0.5 rounded-full"
            style={{ background: 'var(--accent)' }}
            aria-hidden
          />
        </div>
      )}
    </section>
  );
}
