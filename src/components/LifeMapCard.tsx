import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import type { Habit } from '../lib/habits';
import { createHabitObject } from '../lib/habits';
import { fmtMinutes, type Session } from '../lib/store';
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

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const fmt = (n: number) => Math.round(n * 100) / 100;

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
  const stepDeg = 360 / n;
  const gapDeg = Math.min(4, stepDeg * 0.12);
  const R = 88;

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

      {/* wheel + detail: stacked on mobile, map left / action right on desktop */}
      <div className="mt-2 grid items-start gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className="relative mx-auto w-full max-w-[320px]">
          <svg
            viewBox="0 0 200 200"
            className="w-full"
            role="img"
            aria-label={`${balance.score} — ${balance.insight}`}
          >
            {areas.map((a, i) => {
              const a0 = i * stepDeg + gapDeg / 2;
              const a1 = (i + 1) * stepDeg - gapDeg / 2;
              const rC = 22 + (a.currentScore / 10) * (R - 22);
              const rD = 22 + (a.desiredScore / 10) * (R - 22);
              const p0 = polar(100, 100, rC, a0);
              const p1 = polar(100, 100, rC, a1);
              const q0 = polar(100, 100, rD, a0);
              const q1 = polar(100, 100, rD, a1);
              const isSel = selected?.id === a.id;
              const isFocus = balance.focusArea?.id === a.id;
              const iconPos = polar(100, 100, R + 9, a0 + (a1 - a0) / 2);
              return (
                <g
                  key={a.id}
                  className="map-seg"
                  style={
                    {
                      animationDelay: `${Math.min(i * 70, 560)}ms`,
                      '--seg-glow': a.color,
                    } as CSSProperties
                  }
                >
                  {isFocus && (
                    <circle
                      className="focus-pulse"
                      cx={fmt(iconPos.x)}
                      cy={fmt(iconPos.y)}
                      r={7}
                      fill={a.color}
                      aria-hidden
                    />
                  )}
                  <path
                    d={`M 100 100 L ${fmt(p0.x)} ${fmt(p0.y)} A ${fmt(rC)} ${fmt(rC)} 0 0 1 ${fmt(p1.x)} ${fmt(p1.y)} Z`}
                    fill={a.color}
                    opacity={0.07}
                    aria-hidden
                    pointerEvents="none"
                  />
                  <path
                    d={`M 100 100 L ${fmt(p0.x)} ${fmt(p0.y)} A ${fmt(rC)} ${fmt(rC)} 0 0 1 ${fmt(p1.x)} ${fmt(p1.y)} Z`}
                    fill={a.color}
                    fillOpacity={0.3 + 0.55 * (a.importance / 5)}
                    stroke={isSel ? '#f2f4f9' : 'transparent'}
                    strokeWidth={isSel ? 2 : 0}
                    className="cursor-pointer"
                    opacity={isSel ? 1 : 0.92}
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
                  <path
                    d={`M ${fmt(q0.x)} ${fmt(q0.y)} A ${fmt(rD)} ${fmt(rD)} 0 0 1 ${fmt(q1.x)} ${fmt(q1.y)}`}
                    fill="none"
                    stroke="rgb(242 244 249 / 0.75)"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    aria-hidden
                  />
                  <text
                    x={fmt(iconPos.x)}
                    y={fmt(iconPos.y)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="9"
                    pointerEvents="none"
                    aria-hidden
                  >
                    {a.icon}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-4xl font-extrabold leading-none text-cream">
              {balance.score}
            </span>
            <span className="mt-1 max-w-[150px] text-[11px] leading-snug text-sage">
              {balance.insight}
            </span>
          </div>
          <ul className="sr-only">
            {areas.map((a) => (
              <li key={a.id}>
                {a.name}: current {a.currentScore}, desired {a.desiredScore}, importance{' '}
                {a.importance}. {a.intention}
              </li>
            ))}
          </ul>
        </div>

        {/* right column: next action + detail on desktop, review below */}
        <div className="min-w-0 md:pt-1">
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
                className={`px-4 py-3.5 ring-1 ring-inset ring-line ${
                  sheetOpen
                    ? 'sheet-up glass fixed inset-x-3 bottom-3 z-50 rounded-2xl md:static md:rounded-xl md:bg-ink/40'
                    : 'mt-4 hidden rounded-xl bg-ink/40 md:mt-0 md:block'
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
              {(review.totalMinutes > 0 || review.previousTotalMinutes > 0) && (
                <p
                  className="mt-1 font-mono text-[11px]"
                  style={{
                    color:
                      review.totalMinutes > review.previousTotalMinutes
                        ? 'var(--color-mint)'
                        : review.totalMinutes < review.previousTotalMinutes
                          ? 'var(--color-tomato)'
                          : 'var(--color-faint)',
                  }}
                >
                  {review.totalMinutes > review.previousTotalMinutes
                    ? t('lifemap.trend.up', {
                        min: fmtMinutes(review.totalMinutes),
                        delta: fmtMinutes(review.totalMinutes - review.previousTotalMinutes),
                      })
                    : review.totalMinutes < review.previousTotalMinutes
                      ? t('lifemap.trend.down', {
                          min: fmtMinutes(review.totalMinutes),
                          delta: fmtMinutes(review.previousTotalMinutes - review.totalMinutes),
                        })
                      : t('lifemap.trend.flat', { min: fmtMinutes(review.totalMinutes) })}
                </p>
              )}
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
