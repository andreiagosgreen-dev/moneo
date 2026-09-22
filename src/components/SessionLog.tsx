import { fmtTimeOfDay, type Session } from '../lib/store';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  /** Today's sessions, newest first. */
  sessions: Session[];
  /** Resolve an areaId to a display name; unknown ids fall back gracefully. */
  resolveAreaName?: (areaId: string) => string | null;
}

export default function SessionLog({ sessions, resolveAreaName }: Props) {
  const { t, fmtDur } = useI18n();
  if (sessions.length === 0) {
    return (
      <p className="mt-3 text-[13px] leading-relaxed text-faint">{t('session.empty')}</p>
    );
  }
  return (
    <ul className="nice-scroll mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
      {sessions.map((s, i) => {
        const area = s.areaId
          ? resolveAreaName
            ? (resolveAreaName(s.areaId) ?? t('session.deleted'))
            : null
          : null;
        const label =
          area && s.intention
            ? `${area} · ${s.intention}`
            : (area ?? s.intention ?? t('session.generic'));
        return (
          <li
            key={`${s.at}-${i}`}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-ink/50"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            <span className="shrink-0 font-mono text-sage">{fmtTimeOfDay(s.at)}</span>
            <span className="min-w-0 truncate text-cream/90">{label}</span>
            <span className="ml-auto shrink-0 font-mono text-[12px] text-sage">
              +{fmtDur(s.min)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
