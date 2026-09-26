import type { ReactNode } from 'react';
import MonoHead from './MonoHead';
import MonoPath from './MonoPath';
import MonoCoach from './MonoCoach';
import { useI18n } from '../lib/i18n/LocaleContext';
import { currentWeekKeys } from '../lib/timeBlocks';
import type { MonoTab } from './MonoNav';
import { pickProgramCoach } from '../lib/guidance/programCoach';

interface Props {
  timezone: string;
  children: ReactNode;
  onPath?: (tab: MonoTab) => void;
  /** Calendar day key for coach dismiss. */
  dayKey?: string;
  /** True when any focus window exists. */
  hasBlocks?: boolean;
}

/** Schedule screen shell: when you work — not what. */
export default function MonoOrar({ timezone, children, onPath, dayKey, hasBlocks = false }: Props) {
  const { t, fmtDayKey } = useI18n();
  const keys = currentWeekKeys(timezone);
  const range = `${fmtDayKey(keys[0])} – ${fmtDayKey(keys[keys.length - 1])}`;
  const coachKind =
    dayKey != null
      ? pickProgramCoach({
          screen: 'orar',
          planTaskCount: 0,
          planOpenCount: 0,
          hasBlocks,
        })
      : null;

  return (
    <div>
      <MonoHead eyebrow={range} title={t('mono.nav.orar')} sub={t('mono.orar.sub')} />
      {onPath ? <MonoPath active="orar" onGo={onPath} /> : null}
      {coachKind && dayKey ? (
        <div className="mono-pad" style={{ marginBottom: 14 }}>
          <MonoCoach kind={coachKind} dayKey={dayKey} />
        </div>
      ) : null}
      <div className="mono-pad">{children}</div>
    </div>
  );
}
