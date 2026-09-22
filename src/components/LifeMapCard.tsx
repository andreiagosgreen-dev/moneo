import { useEffect, useMemo, useState } from 'react';
import {
  LIFE_MAP_TEMPLATES,
  createLifeMapArea,
  deleteLifeMapArea,
  instantiateTemplate,
  lifeBalance,
  reorderLifeMapArea,
  suggestNextStep,
  updateLifeMapArea,
  weeklyReview,
  type LifeMapArea,
} from '../lib/lifemap';
import {
  buildWheelAssistPrompt,
  labelPoint,
  polarPoint,
  radarPolygon,
  ruleBasedWheelCoach,
  scoreRadius,
  spokeAngle,
  type WheelAssistMode,
} from '../lib/lifeRadar';
import { isLibreAiConfigured, libreAssist } from '../lib/ai/ollama';
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import type { Habit } from '../lib/habits';
import { createHabitObject } from '../lib/habits';
import type { Session } from '../lib/store';
import { createBlock, weekdayOfKey, type TimeBlock, type Weekday } from '../lib/timeBlocks';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  areas: LifeMapArea[];
  areasChange: (areas: LifeMapArea[]) => void;
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  habitsChange: (habits: Habit[]) => void;
  habitLog: Record<string, string[]>;
  history: Session[];
  blocks: TimeBlock[];
  blocksChange: (blocks: TimeBlock[]) => void;
  ivyPlans: IvyPlan[];
  onIvyPlansChange: (plans: IvyPlan[]) => void;
  timezone: string;
  isPro?: boolean;
}

const CX = 140;
const CY = 140;
const OUTER_R = 92;
const VIEW = 280;

export default function LifeMapCard({
  areas,
  areasChange,
  goals,
  projects,
  habits,
  habitsChange,
  habitLog,
  history,
  blocks,
  blocksChange,
  ivyPlans,
  onIvyPlansChange,
  timezone,
  isPro = false,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [blockedNote, setBlockedNote] = useState('');
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistNote, setAssistNote] = useState('');
  // Mobile bottom sheet: tapping a segment opens details as a sheet (<md).
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectArea = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 767px)').matches) setSheetOpen(true);
  };
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  const now = Date.now();
  const i18n = useI18n();
  const { t, tp } = i18n;
  const todayKey = dayKeyInTz(now, timezone);
  const maxIvy = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const balance = useMemo(() => lifeBalance(areas, i18n), [areas, i18n]);
  const step = useMemo(() => suggestNextStep(areas), [areas]);
  const review = useMemo(
    () => (areas.length > 0 ? weeklyReview(areas, history, habitLog, now, i18n) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas, history, habitLog, i18n],
  );

  const stepText = (name: string, intention: string) =>
    intention.trim()
      ? t('lifemap.stepWith', { name, intention: intention.trim() })
      : t('lifemap.stepPlain', { name });

  const selected = areas.find((a) => a.id === selectedId) ?? step?.area ?? areas[0] ?? null;

  const addStep = (text: string) => {
    const { plans, added } = addTaskToDay(ivyPlans, todayKey, text, maxIvy);
    if (added) onIvyPlansChange(plans);
  };

  const addHabitFor = (area: LifeMapArea) => {
    const habit = createHabitObject(`${area.name} — 10 min`, 'daily', 7);
    if (!habit) return;
    habitsChange([...habits, habit]);
    areasChange(
      updateLifeMapArea(areas, area.id, { linkedHabitIds: [...area.linkedHabitIds, habit.id] }),
    );
  };

  const addBlockFor = (area: LifeMapArea) => {
    if (!isPro) {
      setBlockedNote(t('lifemap.proNote'));
      return;
    }
    const start = Math.ceil(now / 3600000) * 60;
    const block = createBlock({
      label: `${area.icon} ${area.name}`,
      weekday: weekdayOfKey(todayKey) as Weekday,
      startMin: start,
      endMin: start + 25,
      color: area.color,
    });
    if (block) blocksChange([...blocks, block]);
  };

  const addArea = () => {
    const area = createLifeMapArea(draftName);
    if (!area) return;
    areasChange([...areas, area]);
    setDraftName('');
    setSelectedId(area.id);
  };

  const applyTemplate = (id: string) => {
    const fresh = instantiateTemplate(id);
    areasChange(fresh);
    setSelectedId(fresh[0]?.id ?? null);
  };

  const setCurrentScore = (id: string, score: number) => {
    areasChange(updateLifeMapArea(areas, id, { currentScore: score }));
  };

  const askAssist = async (mode: WheelAssistMode) => {
    if (assistBusy) return;
    setAssistBusy(true);
    setAssistNote('');
    const fallback = ruleBasedWheelCoach(areas, mode, i18n);
    try {
      if (isLibreAiConfigured()) {
        const prompt = buildWheelAssistPrompt(areas, mode);
        const libre = await libreAssist(prompt, `Locale: ${i18n.locale}. Wheel of Life scores.`);
        if (libre.ok) {
          setAssistNote(libre.text);
          return;
        }
        setAssistNote(`${t('lifemap.assist.offline')}\n\n${fallback}`);
        return;
      }
      setAssistNote(fallback);
    } finally {
      setAssistBusy(false);
    }
  };

  // ---- empty state: template builder (<2 min to first map) ----
  if (areas.length === 0) {
    return (
      <section className="card px-6 py-6 sm:px-7" aria-label={t('lifemap.title')}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t('lifemap.emptyKicker')}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">
          {t('lifemap.emptyTitle')}
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-faint">{t('lifemap.emptySub')}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {LIFE_MAP_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl.id)}
              className="press rounded-xl bg-ink/40 px-4 py-3.5 text-left ring-1 ring-inset ring-line hover:ring-accent/50"
            >
              <span className="block text-[14px] font-semibold text-cream">{tpl.name}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-faint">
                {tpl.hint}
              </span>
              <span className="mt-1 block font-mono text-[10px] text-sage">
                {tpl.areas.length > 0
                  ? tp('lifemap.tplCount', tpl.areas.length)
                  : t('lifemap.tplBlank')}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-faint">{t('lifemap.localOnly')}</p>
      </section>
    );
  }

  const n = areas.length;
  const currentPoly = radarPolygon(
    areas.map((a) => a.currentScore),
    CX,
    CY,
    OUTER_R,
  );
  const desiredPoly = radarPolygon(
    areas.map((a) => a.desiredScore),
    CX,
    CY,
    OUTER_R,
  );
  const ringScores = [2, 4, 6, 8, 10];
  const focusName = balance.focusArea?.name ?? step?.area.name;

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('lifemap.title')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('lifemap.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t('lifemap.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setManaging((m) => !m)}
          aria-expanded={managing}
          className="press shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
        >
          {managing ? t('lifemap.manageDone') : t('lifemap.manage')}
        </button>
      </header>

      <p className="mt-2 text-[12px] leading-relaxed text-sage">{t('lifemap.radar.rateHint')}</p>
      {focusName && (
        <p className="mt-1 text-[12px] leading-relaxed text-cream/90">
          {t('lifemap.radar.raise', { name: focusName })}
        </p>
      )}

      {/* wheel + detail: stacked on mobile, map left / action right on desktop */}
      <div className="mt-3 grid items-start gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="relative mx-auto w-full max-w-[360px]">
          <div
            className="rounded-2xl px-2 py-3"
            style={{
              background:
                'var(--mono-raised, color-mix(in oklab, var(--color-card2) 92%, transparent))',
              boxShadow: 'var(--mono-sh-card, 0 8px 24px -8px rgb(0 0 0 / 0.25))',
            }}
          >
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="w-full"
              role="img"
              aria-label={`${balance.score} — ${balance.insight}`}
            >
              <defs>
                <radialGradient id="lifeRadarFill" cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
                </radialGradient>
              </defs>
              {/* concentric guide rings */}
              {ringScores.map((s) => {
                const r = scoreRadius(s, OUTER_R);
                return (
                  <circle
                    key={s}
                    cx={CX}
                    cy={CY}
                    r={r}
                    fill="none"
                    stroke="var(--color-line)"
                    strokeOpacity={s === 10 ? 0.55 : 0.28}
                    strokeWidth={s === 10 ? 1.25 : 1}
                  />
                );
              })}
              {/* spokes */}
              {areas.map((a, i) => {
                const tip = polarPoint(CX, CY, OUTER_R, spokeAngle(i, n));
                return (
                  <line
                    key={`spoke-${a.id}`}
                    x1={CX}
                    y1={CY}
                    x2={tip.x}
                    y2={tip.y}
                    stroke="var(--color-line)"
                    strokeOpacity={0.35}
                    strokeWidth={1}
                  />
                );
              })}
              {/* desired outline */}
              <polygon
                points={desiredPoly}
                fill="none"
                stroke="rgb(242 244 249 / 0.45)"
                strokeWidth={1.4}
                strokeDasharray="4 3"
                strokeLinejoin="round"
              />
              {/* current satisfaction fill */}
              <polygon
                points={currentPoly}
                fill="url(#lifeRadarFill)"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                className="radar-poly"
              />
              {/* vertices + labels */}
              {areas.map((a, i) => {
                const ang = spokeAngle(i, n);
                const pt = polarPoint(CX, CY, scoreRadius(a.currentScore, OUTER_R), ang);
                const lbl = labelPoint(i, n, CX, CY, OUTER_R, 22);
                const isSel = selected?.id === a.id;
                const isFocus = balance.focusArea?.id === a.id;
                return (
                  <g key={a.id} className="radar-node">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSel ? 6.5 : 5}
                      fill={a.color}
                      stroke={isSel || isFocus ? 'var(--color-cream, #f2f4f9)' : 'transparent'}
                      strokeWidth={isSel || isFocus ? 2 : 0}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={t('lifemap.areaAria', {
                        icon: a.icon,
                        name: a.name,
                        cur: a.currentScore,
                        des: a.desiredScore,
                        imp: a.importance,
                        intention: a.intention,
                      })}
                      onClick={() => selectArea(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectArea(a.id);
                        }
                      }}
                    />
                    <text
                      x={lbl.x}
                      y={lbl.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none select-none"
                      fill={isFocus ? 'var(--accent)' : 'var(--color-sage, #9aa3b5)'}
                      fontSize={10}
                      fontFamily="var(--mono-font-mono, ui-monospace, monospace)"
                    >
                      {a.icon}
                    </text>
                  </g>
                );
              })}
              {/* center score */}
              <circle cx={CX} cy={CY} r={28} fill="var(--color-ink, #0f1218)" fillOpacity={0.55} />
              <text
                x={CX}
                y={CY - 4}
                textAnchor="middle"
                fill="var(--color-cream, #f2f4f9)"
                fontSize={22}
                fontWeight={800}
                fontFamily="var(--mono-font-display, Georgia, serif)"
              >
                {balance.score}
              </text>
              <text
                x={CX}
                y={CY + 14}
                textAnchor="middle"
                fill="var(--color-sage, #9aa3b5)"
                fontSize={8}
                fontFamily="var(--mono-font-mono, ui-monospace, monospace)"
              >
                /100
              </text>
            </svg>
            <div className="mt-1 flex items-center justify-center gap-4 font-mono text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: 'var(--accent)' }}
                />
                {t('lifemap.radar.legendNow')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-0 w-4 border-t border-dashed"
                  style={{ borderColor: 'rgb(242 244 249 / 0.55)' }}
                />
                {t('lifemap.radar.legendWant')}
              </span>
            </div>
            <p className="mx-auto mt-2 max-w-[240px] text-center text-[11px] leading-snug text-sage">
              {balance.insight}
            </p>
          </div>
          <ul className="sr-only">
            {areas.map((a) => (
              <li key={a.id}>
                {a.name}: current {a.currentScore}, desired {a.desiredScore}, importance{' '}
                {a.importance}. {a.intention}
              </li>
            ))}
          </ul>

          {/* quick 1–10 rate */}
          <div className="mt-3 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {t('lifemap.quickRate')}
            </p>
            {areas.map((a) => {
              const isFocus = balance.focusArea?.id === a.id;
              return (
                <div
                  key={a.id}
                  className={`rounded-xl px-3 py-2 ring-1 ring-inset ${
                    isFocus ? 'ring-accent/40 bg-accent/5' : 'ring-line bg-ink/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => selectArea(a.id)}
                      className="press min-w-0 truncate text-left text-[13px] font-medium text-cream/90"
                    >
                      <span
                        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: a.color }}
                      />
                      {a.icon} {a.name}
                    </button>
                    <span className="shrink-0 font-mono text-[11px] text-sage">
                      {a.currentScore}
                      <span className="text-faint"> /10</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={a.currentScore}
                    onChange={(e) => setCurrentScore(a.id, Number(e.target.value))}
                    className="mt-1.5 h-1.5 w-full accent-[var(--accent)]"
                    aria-label={t('lifemap.scoreNow', { name: a.name })}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* right column: next action + detail on desktop, review below */}
        <div className="min-w-0 md:pt-1">
          {/* assistant */}
          <div
            className="rounded-xl px-3.5 py-3 ring-1 ring-inset ring-line"
            style={{
              background:
                'var(--mono-raised, color-mix(in oklab, var(--color-card2) 88%, transparent))',
              boxShadow: 'var(--mono-sh-card, none)',
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              {t('lifemap.assist.title')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={assistBusy}
                onClick={() => void askAssist('reflect')}
                className="press rounded-lg px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
              >
                {assistBusy ? t('lifemap.assist.loading') : t('lifemap.assist.reflect')}
              </button>
              <button
                type="button"
                disabled={assistBusy}
                onClick={() => void askAssist('action')}
                className="press btn-accent rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold disabled:opacity-40"
              >
                {assistBusy ? t('lifemap.assist.loading') : t('lifemap.assist.action')}
              </button>
            </div>
            {assistNote && (
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-cream/90">
                {assistNote}
              </p>
            )}
          </div>
          {/* detail panel — inline card on desktop, bottom sheet on mobile */}
          {selected && (
            <>
              {sheetOpen && (
                <div
                  className="backdrop-fade fixed inset-0 z-40 bg-black/60 md:hidden"
                  onClick={() => setSheetOpen(false)}
                  aria-hidden
                />
              )}
              <div
                aria-label={`${selected.icon} ${selected.name}`}
                className={`mt-3 px-4 py-3.5 ring-1 ring-inset ring-line ${
                  sheetOpen
                    ? 'sheet-up glass fixed inset-x-3 bottom-3 z-50 mt-0 rounded-2xl md:static md:rounded-xl md:bg-ink/40'
                    : 'hidden rounded-xl bg-ink/40 md:block'
                }`}
              >
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold text-cream">
                    {selected.icon} {selected.name}
                  </p>
                  <p className="shrink-0 font-mono text-[11px] text-sage">
                    {selected.currentScore} → {selected.desiredScore} · ★{selected.importance}
                  </p>
                  <button
                    onClick={() => setSheetOpen(false)}
                    className="press shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] text-faint hover:text-cream md:hidden"
                    aria-label={t('shutdown.close')}
                  >
                    ✕
                  </button>
                </div>
                {selected.intention && (
                  <p className="mt-1 text-[13px] leading-relaxed text-sage">{selected.intention}</p>
                )}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((selected.currentScore / Math.max(1, selected.desiredScore)) * 100))}%`,
                      background: selected.color,
                    }}
                  />
                </div>
                <DetailLinks
                  area={selected}
                  goals={goals}
                  projects={projects}
                  habits={habits}
                  emptyText={t('lifemap.noLinks')}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => addStep(stepText(selected.name, selected.intention))}
                    className="press btn-accent rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold"
                    title={t('lifemap.stepTitle')}
                  >
                    {t('lifemap.stepAdd')}
                  </button>
                  <button
                    onClick={() => addHabitFor(selected)}
                    className="press rounded-lg px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
                    title={t('lifemap.habitTitle', { name: selected.name })}
                  >
                    {t('lifemap.habitAdd')}
                  </button>
                  <button
                    onClick={() => addBlockFor(selected)}
                    className="press rounded-lg px-3 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
                    title={t('lifemap.blockTitle')}
                  >
                    {t('lifemap.blockAdd')}
                  </button>
                </div>
                {blockedNote && (
                  <p className="mt-2 font-mono text-[11px] text-faint">{blockedNote}</p>
                )}
              </div>
            </>
          )}

          {/* weekly review */}
          {review && (
            <div className="mt-4 border-t border-line/60 pt-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                {t('lifemap.reviewTitle')}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-cream/90">{review.summary}</p>
              {review.neglected.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {review.neglected.slice(0, 3).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] text-cream/90">
                        {a.icon} {a.name}
                      </span>
                      <button
                        onClick={() => addStep(stepText(a.name, a.intention))}
                        className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                        aria-label={t('lifemap.reviewStepAria', { name: a.name })}
                      >
                        {t('lifemap.reviewStep')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {/* /wheel + detail grid */}
      </div>

      {/* manager */}
      {managing && (
        <div className="mt-4 space-y-2 border-t border-line/60 pt-3">
          {areas.map((a, i) => (
            <AreaRow
              key={a.id}
              area={a}
              index={i}
              total={areas.length}
              goals={goals}
              projects={projects}
              habits={habits}
              onMove={(dir) => areasChange(reorderLifeMapArea(areas, a.id, dir))}
              onSave={(patch) => {
                areasChange(updateLifeMapArea(areas, a.id, patch));
                setEditingId(null);
              }}
              onDelete={() => {
                if (confirm(t('lifemap.mgr.confirm', { name: a.name }))) {
                  areasChange(deleteLifeMapArea(areas, a.id));
                  if (selectedId === a.id) setSelectedId(null);
                }
              }}
              editing={editingId === a.id}
              onEdit={() => setEditingId(editingId === a.id ? null : a.id)}
            />
          ))}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              maxLength={40}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addArea()}
              placeholder={t('lifemap.mgr.addPh')}
              aria-label={t('lifemap.mgr.newAria')}
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <button
              onClick={addArea}
              disabled={!draftName.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label={t('lifemap.mgr.addAria')}
            >
              +
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function DetailLinks({
  area,
  goals,
  projects,
  habits,
  emptyText,
}: {
  area: LifeMapArea;
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  emptyText: string;
}) {
  const names = (ids: string[], pool: Array<{ id: string; name?: string; title?: string }>) =>
    ids
      .map((id) => {
        const hit = pool.find((x) => x.id === id);
        return hit ? (hit.title ?? hit.name ?? null) : null;
      })
      .filter((x): x is string => !!x);
  const linked = [
    ...names(area.linkedGoalIds, goals),
    ...names(area.linkedProjectIds, projects),
    ...names(area.linkedHabitIds, habits),
  ];
  if (linked.length === 0) {
    return <p className="mt-1.5 font-mono text-[10px] text-faint">{emptyText}</p>;
  }
  return (
    <p className="mt-1.5 truncate font-mono text-[10px] text-sage" title={linked.join(' · ')}>
      ⇄ {linked.join(' · ')}
    </p>
  );
}

const ICON_CHOICES = ['❤️', '🧡', '💼', '💰', '📚', '🎨', '🚀', '📈', '🌿', '😴', '👪', '◎'];

function AreaRow({
  area,
  index,
  total,
  goals,
  projects,
  habits,
  onMove,
  onSave,
  onDelete,
  editing,
  onEdit,
}: {
  area: LifeMapArea;
  index: number;
  total: number;
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  onMove: (dir: -1 | 1) => void;
  onSave: (patch: Parameters<typeof updateLifeMapArea>[2]) => void;
  onDelete: () => void;
  editing: boolean;
  onEdit: () => void;
}) {
  const [form, setForm] = useState({
    name: area.name,
    icon: area.icon,
    color: area.color,
    currentScore: area.currentScore,
    desiredScore: area.desiredScore,
    importance: area.importance,
    intention: area.intention,
    linkedGoalIds: area.linkedGoalIds,
    linkedProjectIds: area.linkedProjectIds,
    linkedHabitIds: area.linkedHabitIds,
  });
  const { t } = useI18n();

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="rounded-xl bg-ink/40 px-3.5 py-2.5 ring-1 ring-inset ring-line">
      <div className="flex items-center gap-2">
        <span className="text-[15px]" aria-hidden>
          {area.icon}
        </span>
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-cream hover:text-accent"
          aria-expanded={editing}
        >
          {area.name}
        </button>
        <span className="shrink-0 font-mono text-[11px] text-sage">
          {area.currentScore}→{area.desiredScore} · ★{area.importance}
        </span>
        <button
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="press shrink-0 rounded px-1 font-mono text-[11px] text-faint hover:text-cream disabled:opacity-30"
          aria-label={t('lifemap.mgr.moveUp', { name: area.name })}
        >
          ▲
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="press shrink-0 rounded px-1 font-mono text-[11px] text-faint hover:text-cream disabled:opacity-30"
          aria-label={t('lifemap.mgr.moveDown', { name: area.name })}
        >
          ▼
        </button>
        <button
          onClick={onDelete}
          className="press shrink-0 rounded p-1 text-faint hover:text-tomato"
          aria-label={t('lifemap.mgr.del', { name: area.name })}
        >
          ✕
        </button>
      </div>

      {editing && (
        <div className="mt-2.5 space-y-2 border-t border-line/60 pt-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.name}
              maxLength={40}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label={t('lifemap.mgr.name')}
              className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2.5 text-[13px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            />
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#3ecf8e'}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              aria-label={t('lifemap.mgr.color')}
              title={t('lifemap.mgr.color')}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-lg bg-ink/60 ring-1 ring-inset ring-line"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('lifemap.mgr.icon')}>
            {ICON_CHOICES.map((icon) => (
              <button
                key={icon}
                onClick={() => setForm({ ...form, icon })}
                aria-pressed={form.icon === icon}
                className={`press h-7 w-7 rounded-lg text-[15px] ring-1 ring-inset ${
                  form.icon === icon ? 'ring-accent' : 'ring-line'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
          {(
            [
              ['currentScore', 'lifemap.mgr.now', 10],
              ['desiredScore', 'lifemap.mgr.want', 10],
              ['importance', 'lifemap.mgr.matters', 5],
            ] as const
          ).map(([key, labelKey, max]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">
                {t(labelKey)}
              </span>
              <input
                type="range"
                min={1}
                max={max}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                className="h-1.5 flex-1 accent-[var(--accent)]"
                aria-label={`${area.name} ${t(labelKey).toLowerCase()}`}
              />
              <span className="w-5 shrink-0 text-right font-mono text-[11px] text-sage">
                {form[key]}
              </span>
            </div>
          ))}
          <input
            type="text"
            value={form.intention}
            maxLength={140}
            onChange={(e) => setForm({ ...form, intention: e.target.value })}
            placeholder={t('lifemap.mgr.intentionPh')}
            aria-label={t('lifemap.mgr.intention')}
            className="h-8 w-full rounded-lg bg-ink/60 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
          <details>
            <summary className="cursor-pointer font-mono text-[10px] text-sage hover:text-cream">
              {t('lifemap.mgr.links', {
                g: form.linkedGoalIds.length,
                p: form.linkedProjectIds.length,
                h: form.linkedHabitIds.length,
              })}
            </summary>
            <div className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
              {goals.map((g) => (
                <label
                  key={g.id}
                  className="flex cursor-pointer items-center gap-2 text-[12px] text-sage"
                >
                  <input
                    type="checkbox"
                    checked={form.linkedGoalIds.includes(g.id)}
                    onChange={() =>
                      setForm({ ...form, linkedGoalIds: toggle(form.linkedGoalIds, g.id) })
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">🎯 {g.title}</span>
                </label>
              ))}
              {projects.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 text-[12px] text-sage"
                >
                  <input
                    type="checkbox"
                    checked={form.linkedProjectIds.includes(p.id)}
                    onChange={() =>
                      setForm({ ...form, linkedProjectIds: toggle(form.linkedProjectIds, p.id) })
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">📁 {p.name}</span>
                </label>
              ))}
              {habits.map((h) => (
                <label
                  key={h.id}
                  className="flex cursor-pointer items-center gap-2 text-[12px] text-sage"
                >
                  <input
                    type="checkbox"
                    checked={form.linkedHabitIds.includes(h.id)}
                    onChange={() =>
                      setForm({ ...form, linkedHabitIds: toggle(form.linkedHabitIds, h.id) })
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span className="truncate">✓ {h.name}</span>
                </label>
              ))}
              {goals.length + projects.length + habits.length === 0 && (
                <p className="font-mono text-[10px] text-faint">{t('lifemap.mgr.noTargets')}</p>
              )}
            </div>
          </details>
          <div className="flex justify-end">
            <button
              onClick={() => onSave(form)}
              className="press btn-accent rounded-lg px-3 py-1.5 text-[12px] font-semibold"
            >
              {t('lifemap.mgr.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
