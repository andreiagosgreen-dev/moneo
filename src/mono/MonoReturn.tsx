import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import type { MonoTab } from './MonoNav';

const SECTION: Record<MonoTab, TKey> = {
  focus: 'mono.nav.focus',
  today: 'mono.nav.azi',
  orar: 'mono.nav.orar',
  projects: 'mono.nav.proiecte',
  reports: 'mono.nav.rapoarte',
  plan: 'nav.plan',
  growth: 'nav.growth',
  map: 'nav.map',
  graph: 'nav.graph',
  settings: 'mono.nav.settings',
  more: 'mono.nav.more',
};

interface Props {
  to: MonoTab;
  onBack: () => void;
}

/** Shown after a jump-to-fill: one tap back to where you were working. */
export default function MonoReturn({ to, onBack }: Props) {
  const { t } = useI18n();
  return (
    <div className="mono-return">
      <button type="button" className="mono-return-btn" onClick={onBack}>
        {t('mono.return.back', { section: t(SECTION[to]) })}
      </button>
    </div>
  );
}
