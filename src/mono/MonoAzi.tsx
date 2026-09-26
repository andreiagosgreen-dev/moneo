import { useState, type ReactNode } from 'react';
import MonoHead from './MonoHead';
import MonoCard from './MonoCard';
import MonoBtn from './MonoBtn';
import MonoTick from './MonoTick';
import MonoProgress from './MonoProgress';
import MonoPath from './MonoPath';
import MonoCoach from './MonoCoach';
import { useI18n } from '../lib/i18n/LocaleContext';
import { dayLabel } from './monoDate';
import type { MonoTab } from './MonoNav';
import { pickProgramCoach } from '../lib/guidance/programCoach';

export interface MonoAziItem {
  id: string;
  text: string;
  meta: string;
  done: boolean;
}

interface Props {
  /** Calendar day key for coach dismiss (YYYY-M-D). */
  dayKey: string;
  doneCount: number;
  totalCount: number;
  items: MonoAziItem[];
  maxTasks: number;
  morningLabel: string;
  shutdownLabel: string;
  onMorning: () => void;
  onShutdown: () => void;
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  /** Jump to Focus to work the list. */
  onGoWork?: () => void;
  /** Path map navigation. */
  onPath?: (tab: MonoTab) => void;
  /** Optional attributed daily motto (calm, one line). */
  motto?: { text: string; source: string };
  estimates?: ReactNode;
  /** Optional schedule strip — omit when empty noise (Orar owns blocks). */
  program?: ReactNode;
  more?: ReactNode;
}

/** Today screen: rituals, progress, priorities, then optional extras. */
export default function MonoAzi({
  dayKey,
  doneCount,
  totalCount,
  items,
  maxTasks,
  morningLabel,
  shutdownLabel,
  onMorning,
  onShutdown,
  onToggle,
  onAdd,
  onGoWork,
  onPath,
  motto,
  estimates,
  program,
  more,
}: Props) {
  const { t, tag, fmtNum } = useI18n();
  const [draft, setDraft] = useState('');
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const full = totalCount >= maxTasks;
  const hasItems = items.length > 0;
  const hasOpen = items.some((x) => !x.done);
  const openCount = items.filter((x) => !x.done).length;
  const coachKind = pickProgramCoach({
    screen: 'today',
    planTaskCount: totalCount,
    planOpenCount: openCount,
    hasBlocks: false,
  });

  const submit = () => {
    const clean = draft.trim();
    if (!clean || full) return;
    onAdd(clean);
    setDraft('');
  };

  const addForm = (
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
        className="mono-field"
        type="text"
        value={draft}
        disabled={full}
        placeholder={full ? t('mono.azi.full', { max: maxTasks }) : t('mono.azi.addPh')}
        autoComplete="off"
        style={{ flex: 1 }}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button
        type="submit"
        disabled={full || draft.trim().length === 0}
        aria-label={t('mono.azi.addBtn')}
        className="mono-btn mono-btn-primary"
        style={{ padding: '0 18px', minWidth: 52 }}
      >
        +
      </button>
    </form>
  );

  return (
    <div>
      <MonoHead eyebrow={dayLabel(tag)} title={t('mono.azi.title')} sub={t('mono.azi.sub')} />
      {onPath ? <MonoPath active="today" onGo={onPath} /> : null}
      {motto?.text ? (
        <p className="mono-azi-motto-line">
          “{motto.text}”
          <span className="mono-azi-motto-src"> — {motto.source}</span>
        </p>
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
          <div className="mono-between">
            <div>
              <div className="mono-h3">
                {t('mono.azi.count', { done: fmtNum(doneCount), total: fmtNum(totalCount) })}
              </div>
              <p className="mono-meta" style={{ marginTop: 3 }}>
                {t('mono.azi.motto')}
              </p>
            </div>
            <div
              className="mono-num"
              style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              {fmtNum(pct)}%
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <MonoProgress value={pct} label={t('mono.azi.title')} />
          </div>
        </MonoCard>
      </div>

      {coachKind ? (
        <div className="mono-pad" style={{ marginTop: 14 }}>
          <MonoCoach
            kind={coachKind}
            dayKey={dayKey}
            onExample={coachKind === 'aziEmpty' ? (text) => setDraft(text) : undefined}
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
                      {item.text}
                    </div>
                    {item.meta && <div className="mono-meta">{item.meta}</div>}
                  </div>
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

      {more}
    </div>
  );
}
