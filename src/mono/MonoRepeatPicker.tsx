import { useEffect, useId, useState } from 'react';
import MonoChip from './MonoChip';
import { useI18n } from '../lib/i18n/LocaleContext';
import { parseDayKey, weekdayIndexMon } from '../lib/dayKeys';
import { describeRule, weekdayNames, type RepeatRule } from '../lib/recurrence';
import type { TKey } from '../lib/i18n/types';

type Choice = 'none' | 'daily' | 'everyDays' | 'weekdays' | 'weeks' | 'months';

const CHOICES: Choice[] = ['none', 'daily', 'everyDays', 'weekdays', 'weeks', 'months'];
const MAX_EVERY = { days: 365, weeks: 52, months: 12 } as const;

interface Props {
  value: RepeatRule | null;
  onChange: (rule: RepeatRule | null) => void;
  /** Due day ("YYYY-M-D") used to seed the weekday / day of month. */
  dueKey?: string;
}

function choiceOf(rule: RepeatRule | null): Choice {
  if (!rule) return 'none';
  if (rule.kind === 'days') return rule.every === 1 ? 'daily' : 'everyDays';
  return rule.kind;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Repeat rule editor: kind, interval, weekdays or day of month, live summary. */
export default function MonoRepeatPicker({ value, onChange, dueKey }: Props) {
  const i18n = useI18n();
  const { t, tag } = i18n;
  const id = useId();
  const choice = choiceOf(value);
  const every = value && 'every' in value ? value.every : 1;
  const [draft, setDraft] = useState(String(every));
  useEffect(() => setDraft(String(every)), [every]);
  const seed = dueKey && parseDayKey(dueKey) ? dueKey : todayKey();

  const pick = (c: Choice) => {
    if (c === 'none') onChange(null);
    else if (c === 'daily') onChange({ kind: 'days', every: 1 });
    else if (c === 'everyDays')
      onChange({ kind: 'days', every: value?.kind === 'days' ? Math.max(2, value.every) : 2 });
    else if (c === 'weekdays') onChange({ kind: 'weekdays' });
    else if (c === 'weeks')
      onChange({ kind: 'weeks', every: 1, weekdays: [weekdayIndexMon(seed)] });
    else onChange({ kind: 'months', every: 1, day: parseDayKey(seed)!.d });
  };

  const setEvery = (raw: string) => {
    setDraft(raw);
    if (!value || !('every' in value)) return;
    const n = Number(raw);
    const max = MAX_EVERY[value.kind];
    if (Number.isInteger(n) && n >= 1 && n <= max) onChange({ ...value, every: n });
  };

  const toggleDay = (d: number) => {
    if (value?.kind !== 'weeks') return;
    const has = value.weekdays.includes(d);
    if (has && value.weekdays.length === 1) return;
    const weekdays = has
      ? value.weekdays.filter((x) => x !== d)
      : [...value.weekdays, d].sort((a, b) => a - b);
    onChange({ ...value, weekdays });
  };

  const names = weekdayNames(tag);
  const showEvery = choice === 'everyDays' || choice === 'weeks' || choice === 'months';

  return (
    <div className="mono-repeat" data-testid="repeat-picker">
      <div className="mono-repeat-row">
        <select
          className="mono-field mono-repeat-kind"
          aria-label={t('task.rep.aria')}
          value={choice}
          onChange={(e) => pick(e.target.value as Choice)}
        >
          {CHOICES.map((c) => (
            <option key={c} value={c}>
              {t(`task.rep.${c}` as TKey)}
            </option>
          ))}
        </select>
        {showEvery ? (
          <label className="mono-repeat-every">
            <span className="mono-meta">{t('task.rep.every')}</span>
            <input
              className="mono-field mono-repeat-num"
              type="number"
              inputMode="numeric"
              min={1}
              max={value && 'every' in value ? MAX_EVERY[value.kind] : 365}
              value={draft}
              onChange={(e) => setEvery(e.target.value)}
              onBlur={() => setDraft(String(every))}
            />
          </label>
        ) : null}
        {value?.kind === 'months' ? (
          <label className="mono-repeat-every">
            <span className="mono-meta" id={`${id}-dom`}>
              {t('task.rep.dayOfMonth')}
            </span>
            <select
              className="mono-field mono-repeat-num"
              aria-labelledby={`${id}-dom`}
              value={value.day}
              onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {value?.kind === 'weeks' ? (
        <div className="mono-repeat-days" role="group" aria-label={t('task.rep.weeks')}>
          {names.map((n, d) => (
            <MonoChip
              key={d}
              type="button"
              pressed={value.weekdays.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {n}
            </MonoChip>
          ))}
        </div>
      ) : null}
      {value?.kind === 'months' && value.day > 28 ? (
        <p className="mono-meta">{t('task.rep.shortMonths')}</p>
      ) : null}
      {value ? (
        <p className="mono-meta mono-repeat-sum" aria-live="polite">
          ↻ {describeRule(value, i18n)}
        </p>
      ) : null}
    </div>
  );
}
