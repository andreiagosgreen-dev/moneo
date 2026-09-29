import MonoPill from './MonoPill';
import { useI18n } from '../lib/i18n/LocaleContext';
import { hasQuickTokens, type QuickAdd } from '../lib/quickAdd';
import { localDayKey } from '../lib/projects';
import { priorityTone } from '../lib/taskDue';
import type { TaskPriority } from '../lib/tasks';

export interface QuickFields {
  dueAt: number | null;
  hasTime: boolean;
  priority: TaskPriority | null;
  estimateMin: number | null;
}

/** Date, priority and duration pills for a parsed phrase or a saved task. */
export function QuickPills({ q, now = Date.now() }: { q: QuickFields; now?: number }) {
  const { t, fmtDayKey, fmtDur, fmtClock } = useI18n();
  let date: string | null = null;
  if (q.dueAt !== null) {
    const key = localDayKey(q.dueAt);
    const day =
      key === localDayKey(now)
        ? t('mono.qa.today')
        : key === localDayKey(now + 86_400_000)
          ? t('mono.qa.tomorrow')
          : fmtDayKey(key);
    const d = new Date(q.dueAt);
    date = q.hasTime
      ? t('mono.qa.at', { date: day, time: fmtClock(d.getHours() * 60 + d.getMinutes()) })
      : day;
  }
  if (!date && !q.priority && q.estimateMin === null) return null;
  return (
    <span className="mono-azi-pills mono-qa-pills">
      {date ? <MonoPill tone="accent">{date}</MonoPill> : null}
      {q.priority ? (
        <MonoPill tone={priorityTone(q.priority)}>
          {t(`task.prio.${q.priority}` as 'task.prio.p0')}
        </MonoPill>
      ) : null}
      {q.estimateMin !== null ? <MonoPill tone="outline">{fmtDur(q.estimateMin)}</MonoPill> : null}
    </span>
  );
}

/** Live "will be added as" preview under a quick-add field. */
export default function MonoQuickPreview({
  q,
  id,
  now,
}: {
  q: QuickAdd;
  id?: string;
  now?: number;
}) {
  const { t } = useI18n();
  const show = hasQuickTokens(q);
  return (
    <div id={id} className="mono-qa-preview" aria-live="polite">
      {show ? (
        <>
          <span className="sr-only">{t('mono.qa.previewAria')}</span>
          <QuickPills q={q} now={now} />
          {q.priority ? <span className="mono-meta">{t('mono.qa.prioHelp')}</span> : null}
        </>
      ) : null}
    </div>
  );
}
