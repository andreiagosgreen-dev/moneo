import { useMemo, useState } from 'react';
import {
  MOOD_LABELS,
  WEEKLY_REFLECTION_PROMPTS,
  promptForDay,
  recentEntries,
  upsertEntry,
  weeklySummary,
  type Mood,
} from '../../lib/journal';
import { localDayKey } from '../../lib/projects';
import type { LifeCardProps } from './types';
import { useI18n } from '../../lib/i18n/LocaleContext';
import LinkedItems from '../LinkedItems';

export default function JournalTab({
  journal,
  journalChange,
  history,
  goals,
  projects,
  skills,
  objectives,
  links,
  onLinksChange,
  isPro = false,
}: LifeCardProps) {
  const { t } = useI18n();
  const todayKey = localDayKey(Date.now());
  const entry = journal[todayKey];
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [gratitude, setGratitude] = useState<string[]>(entry?.gratitude ?? []);
  const [gratDraft, setGratDraft] = useState('');
  const [text, setText] = useState(entry?.text ?? '');
  const [savedTick, setSavedTick] = useState(0);

  const prompt = useMemo(() => promptForDay(Date.now()), []);
  const recent = useMemo(() => (isPro ? recentEntries(journal, 7) : []), [journal, isPro]);
  const summary = useMemo(
    () => (isPro ? weeklySummary(history, journal) : null),
    [history, journal, isPro],
  );

  const save = () => {
    journalChange(upsertEntry(journal, todayKey, { mood, gratitude, text }));
    setSavedTick((t) => t + 1);
  };

  return (
    <div>
      <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] font-medium leading-relaxed text-cream">
        {prompt}
      </p>

      <div className="mt-3 flex items-center gap-1.5" role="group" aria-label={t('journal.moodGroupLabel')}>
        {([1, 2, 3, 4, 5] as Mood[]).map((m) => (
          <button
            key={m}
            onClick={() => setMood(mood === m ? null : m)}
            className={`press h-9 flex-1 rounded-lg font-mono text-[12px] ring-1 ring-inset transition-colors ${
              mood === m
                ? 'bg-accent/20 text-cream ring-accent/60'
                : 'text-faint ring-line hover:text-cream'
            }`}
            title={MOOD_LABELS[m]}
            aria-pressed={mood === m}
          >
            {m}
          </button>
        ))}
        <span className="ml-1 w-14 shrink-0 font-mono text-[10px] text-faint">
          {mood ? MOOD_LABELS[mood] : '—'}
        </span>
      </div>

      <div className="mt-2.5">
        <div className="flex flex-wrap gap-1.5">
          {gratitude.map((g) => (
            <span
              key={g}
              className="flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 text-[12px] text-sage ring-1 ring-inset ring-line"
            >
              ♥ {g}
              <button
                onClick={() => setGratitude(gratitude.filter((x) => x !== g))}
                className="press text-faint hover:text-cream"
                aria-label={t('journal.removeGratitude', { item: g })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        {gratitude.length < 3 && (
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="text"
              value={gratDraft}
              maxLength={120}
              onChange={(e) => setGratDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && gratDraft.trim()) {
                  setGratitude([...gratitude, gratDraft.trim()]);
                  setGratDraft('');
                }
              }}
              placeholder={t('journal.gratefulPlaceholder')}
              className="h-8 min-w-0 flex-1 rounded-lg bg-ink/40 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
          </div>
        )}
      </div>

      <textarea
        value={text}
        maxLength={2000}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('journal.reflectionPlaceholder')}
        className="mt-2.5 w-full resize-y rounded-lg bg-ink/40 px-3 py-2.5 text-[13px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          className="press btn-accent rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {t('journal.saveEntry')}
        </button>
        {savedTick > 0 && <span className="font-mono text-[11px] text-sage">{t('journal.saved')}</span>}
      </div>

      <LinkedItems
        entityType="journal"
        entityId={todayKey}
        links={links}
        onLinksChange={onLinksChange}
        goals={goals}
        projects={projects}
        skills={skills}
        objectives={objectives}
      />

      {isPro && (
        <div className="mt-4 border-t border-line/60 pt-3">
          {summary && (
            <p className="font-mono text-[11px] leading-relaxed text-faint">
              {t('journal.weekSummary', {
                min: summary.minutes,
                sessions: summary.sessions,
                days: summary.daysActive,
              })}
              {summary.mood !== null &&
                t('journal.weekSummaryMood', { mood: summary.mood.toFixed(1) })}
            </p>
          )}
          <ul className="mt-2 space-y-1">
            {WEEKLY_REFLECTION_PROMPTS.map((q) => (
              <li key={q} className="text-[12px] text-sage">
                → {q}
              </li>
            ))}
          </ul>
          {recent.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {recent.map((e) => (
                <li
                  key={e.dayKey}
                  className="rounded-lg bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] text-faint">{e.dayKey}</span>
                    {e.mood !== undefined && (
                      <span className="font-mono text-[10px] text-sage">
                        {e.mood}/5 · {MOOD_LABELS[e.mood]}
                      </span>
                    )}
                  </div>
                  {e.text && <p className="mt-0.5 truncate text-[12px] text-cream/80">{e.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!isPro && (
        <p className="mt-3 font-mono text-[11px] text-faint">{t('journal.proUpsell')}</p>
      )}
    </div>
  );
}
