import type { ReactNode } from 'react';
import MonoHead from './MonoHead';
import { useI18n } from '../lib/i18n/LocaleContext';
import { currentWeekKeys } from '../lib/timeBlocks';

interface Props {
  timezone: string;
  children: ReactNode;
}

/** Schedule screen shell (V1 prototype): week-range head + content. */
export default function MonoOrar({ timezone, children }: Props) {
  const { t, fmtDayKey } = useI18n();
  const keys = currentWeekKeys(timezone);
  const range = `${fmtDayKey(keys[0])} – ${fmtDayKey(keys[keys.length - 1])}`;
  return (
    <div>
      <MonoHead eyebrow={range} title={t('mono.nav.orar')} />
      <div className="mono-pad">{children}</div>
    </div>
  );
}
