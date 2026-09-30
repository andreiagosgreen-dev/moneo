import { useMemo, useState, type ReactNode } from 'react';
import MonoHead from './MonoHead';
import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import MonoTick from './MonoTick';
import MonoRing from './MonoRing';
import MonoPill from './MonoPill';
import MonoPath from './MonoPath';
import MonoCoach from './MonoCoach';
import { useI18n } from '../lib/i18n/LocaleContext';
import { dayLabel } from './monoDate';
import type { MonoTab } from './MonoNav';
import { pickProgramCoach } from '../lib/guidance/programCoach';
import type { TaskPriority } from '../lib/tasks';
import { dueTone, priorityTone, type DueStatus } from '../lib/taskDue';
import { hasQuickTokens, parseQuickAdd } from '../lib/quickAdd';
import MonoQuickPreview from './MonoQuickPreview';

export interface MonoAziItem {
  id: string;
  text: string;
  meta: string;
  done: boolean;
  /** Only for items linked to a task via taskId. */
  priority?: TaskPriority;
  due?: DueStatus | null;
  /** Offer one-tap "tomorrow" (overdue, due today or carried over). */
  snooze?: boolean;
  /** Linked task icon (decorative). */
  icon?: string;
}

interface Props {
  /** Calendar day key for coach dismiss (YYYY-M-D). */
  dayKey: string;
  doneCount: number;
  totalCount: number;
  /** Focus minutes completed today (account timezone). */
  focusMinToday?: number;
  items: MonoAziItem[];
  maxTasks: number;
  morningLabel: string;
  shutdownLabel: string;
  onMorning: () => void;
  onShutdown: () => void;
  onToggle: (id: string) => void;
  /** Return false to keep the draft (nothing was saved). */
  onAdd: (text: string) => boolean | void;
  /** Move one item to tomorrow's list. */
  onSnooze?: (id: string) => void;
  /** Jump to Focus to work the list. */
  onGoWork?: () => void;
  /** Path map navigation. */
  onPath?: (tab: MonoTab) => void;
  /** Optional attributed daily motto (calm, one line). */
  motto?: { text: string; source: string };
  /** "Last week" summary card, shown at the start of a new week. */
  recap?: ReactNode;
  /** Status banner above the rituals (e.g. vacation). */
  banner?: ReactNode;
  estimates?: ReactNode;
  /** Optional schedule strip — omit when empty noise (Orar owns blocks). */
  program?: ReactNode;
  /** Habit check-in for today (Mono surface; full Life stays under More). */
  habits?: ReactNode;
  /** Workout ring + today's scheduled routine (only when the user trains). */
  move?: ReactNode;
  /** Daily energy + mood check-in. */
  checkin?: ReactNode;
  more?: ReactNode;
}

/** Today screen: rituals, progress, priorities, then optional extras. */
export default function MonoAzi({
  dayKey,
  doneCount,
  totalCount,
  focusMinToday = 0,
  items,
  maxTasks,
  morningLabel,
  shutdownLabel,
  onMorning,
  onShutdown,
  onToggle,
  onAdd,
  onSnooze,
  onGoWork,
  onPath,
  motto,
  recap,
  banner,
  estimates,
  program,
  habits,
  move,
  checkin,
  more,
}: Props) {
  const { t, tp, tag, fmtNum, fmtDur, locale } = useI18n();
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(draft, locale), [draft, locale]);
  const onlyTokens = hasQuickTokens(parsed) && parsed.title === '';
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const full = totalCount >= maxTasks;
  const hasItems = items.length > 0;
  const hasOpen = items.some((x) => !x.done);
  const dueLabel = (due: DueStatus): string => {
    if (due.kind === 'today') return t('task.due.today');
    if (due.kind === 'tomorrow') return t('task.due.tomorrow');
    return tp(due.kind === 'overdue' ? 'task.due.overdue' : 'task.due.inDays', due.days);
  };
  const openCount = items.filter((x) => !x.done).length;
  const coachKind = pickProgramCoach({
    screen: 'today',
    planTaskCount: totalCount,
    planOpenCount: openCount,
    hasBlocks: false,
  });

  const pills = (item: MonoAziItem) => {
    const showPrio = item.priority === 'p0' || item.priority === 'p1';
    if (!showPrio && !item.due) return null;
    return (
      <div className="mono-azi-pills">
        {showPrio && item.priority ? (
          <MonoPill tone={priorityTone(item.priority)} done={item.done}>
            {t(`task.prio.${item.priority}` as 'task.prio.p0')}
          </MonoPill>
        ) : null}
        {item.due ? (
          <MonoPill tone={dueTone(item.due)} done={item.done}>
            {dueLabel(item.due)}
          </MonoPill>
        ) : null}
      </div>
    );
  };

  const submit = () => {
    const clean = draft.trim();
    if (!clean || onlyTokens) return;
    if (onAdd(clean) !== false) setDraft('');
  };

  const addForm = (
    <>
      <form
        className="mono-row"
        style={{ gap: 10, marginTop: hasItems ? 12 : 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label
          htmlFor="mono-azi-new"
          className="mono-eyebrow"
          style={{ position: 'absolute', left: -9999 }}
        >
          {t('mono.azi.addPh')}
        </label>
        <input
          id="mono-azi-new"
          className="mono-field mono-ph-fit"
          type="text"
          value={draft}
          placeholder={full ? t('mono.azi.full', { max: maxTasks }) : t('mono.azi.addPh')}
          autoComplete="off"
          aria-describedby="mono-azi-qa"
          style={{ flex: 1 }}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="submit"
          disabled={draft.trim().length === 0 || onlyTokens}
          aria-label={t('mono.azi.addBtn')}
          className="mono-btn mono-btn-primary"
          style={{ padding: '0 18px', minWidth: 52 }}
        >
          +
        </button>
      </form>
      <MonoQuickPreview q={parsed} id="mono-azi-qa" />
      {focused && draft.trim() === '' ? (
        <p className="mono-meta mono-qa-hint">{t('mono.qa.hint')}</p>
      ) : null}
    </>
  );

  return (
    <div>
      <MonoHead eyebrow={dayLabel(tag)} title={t('mono.azi.title')} sub={t('mono.azi.sub')} />
      {onPath ? <MonoPath active="today" onGo={onPath} /> : null}
      {motto?.text ? (
        <p className="mono-azi-motto-line">
          “{motto.text}”<span className="mono-azi-motto-src"> — {motto.source}</span>
        </p>
      ) : null}
      {banner ? (
        <div className="mono-pad" style={{ marginBottom: 14 }}>
          {banner}
        </div>
      ) : null}
      {recap ? (
        <div className="mono-pad" style={{ marginBottom: 14 }}>
          {recap}
        </div>
      ) : null}

      <div className="mono-pad">
        <div className="mono-row" style={{ gap: 8 }}>
          <MonoBtn variant="ghost" onClick={onMorning} block>
            {morningLabel}
          </MonoBtn>
          <MonoBtn variant="ghost" onClick={onShutdown} block>
            {shutdownLabel}
          </MonoBtn>
        </div>
        {estimates}
      </div>

      <div className="mono-pad" style={{ marginTop: 14 }}>
        <MonoCard>
          <div className="mono-azi-summary">
            <MonoRing
              value={pct}
              size={64}
              label={t('mono.azi.ringAria', {
                done: fmtNum(doneCount),
                total: fmtNum(totalCount),
                pct: fmtNum(pct),
              })}
            >
              {fmtNum(pct)}%
            </MonoRing>
            <div className="mono-list-grow">
              {totalCount > 0 ? (
                <div className="mono-h3">
                  {t('mono.azi.dayRing', {
                    done: fmtNum(doneCount),
                    total: fmtNum(totalCount),
                    pct: fmtNum(pct),
                  })}
                </div>
              ) : null}
              <p className="mono-meta" style={{ marginTop: totalCount > 0 ? 3 : 0 }}>
                {focusMinToday > 0
                  ? t('mono.azi.focusToday', { dur: fmtDur(focusMinToday) })
                  : t('mono.azi.focusNone')}
              </p>
              <p className="mono-meta" style={{ marginTop: 3 }}>
                {t('mono.azi.motto')}
              </p>
            </div>
          </div>
        </MonoCard>
      </div>

      {coachKind ? (
        <div className="mono-pad" style={{ marginTop: 14 }}>
          <MonoCoach
            kind={coachKind}
            dayKey={dayKey}
            onCta={coachKind === 'aziDone' ? onShutdown : undefined}
            ctaLabel={coachKind === 'aziDone' ? shutdownLabel : undefined}
          />
        </div>
      ) : null}

      <section className="mono-sec mono-pad" aria-label={t('mono.azi.prio')}>
        <p className="mono-eyebrow" style={{ marginBottom: 8 }}>
          {t('mono.azi.prio')}
        </p>

        {hasItems ? (
          <>
            <MonoCard style={{ padding: '8px 16px' }}>
              {items.map((item) => (
                <div key={item.id} className="mono-list-row">
                  <MonoTick
                    checked={item.done}
                    onToggle={() => onToggle(item.id)}
                    label={item.text}
                  />
                  <div className="mono-list-grow">
                    <div
                      className="mono-h3"
                      style={
                        item.done
                          ? { textDecoration: 'line-through', color: 'var(--mono-muted)' }
                          : undefined
                      }
                    >
                      {item.icon ? (
                        <span className="mono-icon-inline" aria-hidden>
                          {item.icon}
                        </span>
                      ) : null}
                      {item.text}
                    </div>
                    {pills(item)}
                    {item.meta && <div className="mono-meta">{item.meta}</div>}
                  </div>
                  {onSnooze && item.snooze && !item.done ? (
                    <button
                      type="button"
                      className="mono-week-nav mono-azi-snooze"
                      aria-label={t('mono.azi.snooze', { title: item.text })}
                      title={t('mono.azi.snooze', { title: item.text })}
                      onClick={() => onSnooze(item.id)}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ))}
            </MonoCard>
            {addForm}
            {hasOpen && onGoWork ? (
              <div style={{ marginTop: 14 }}>
                <MonoBtn variant="primary" onClick={onGoWork} block>
                  {t('mono.azi.goWork')}
                </MonoBtn>
              </div>
            ) : null}
          </>
        ) : (
          <MonoCard>{addForm}</MonoCard>
        )}
      </section>

      {program ? (
        <section className="mono-sec mono-pad" aria-label={t('mono.azi.program')}>
          <p className="mono-eyebrow" style={{ marginBottom: 8 }}>
            {t('mono.azi.program')}
          </p>
          {program}
        </section>
      ) : null}

      {habits}

      {move}

      {checkin}

      {more ? <div className="mono-pad-mobile">{more}</div> : null}
    </div>
  );
}
