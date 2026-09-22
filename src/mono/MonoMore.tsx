import { Link } from 'react-router-dom';
import MonoHead from './MonoHead';
import type { MonoTab } from './MonoNav';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Entry {
  id: Extract<MonoTab, 'plan' | 'growth' | 'map' | 'graph' | 'settings'>;
  label: TKey;
  hint: TKey;
}

/** Mobile overflow: planning modules first, then settings. Desktop has these in the rail. */
const ENTRIES: Entry[] = [
  { id: 'plan', label: 'nav.plan', hint: 'nav.hint.plan' },
  { id: 'growth', label: 'nav.growth', hint: 'nav.hint.growth' },
  { id: 'map', label: 'nav.map', hint: 'nav.hint.map' },
  { id: 'graph', label: 'nav.graph', hint: 'nav.hint.graph' },
  { id: 'settings', label: 'nav.settingsLabel', hint: 'nav.settingsTitle' },
];

interface Props {
  tab: MonoTab;
  onOpen: (t: MonoTab) => void;
}

export default function MonoMore({ tab, onOpen }: Props) {
  const { t } = useI18n();
  return (
    <div className="mono-more">
      <MonoHead eyebrow={t('mono.nav.more')} title={t('mono.nav.moreTitle')} />
      <p className="mono-meta mono-pad">{t('mono.nav.moreSub')}</p>

      <div className="mono-more-col mono-pad">
        <ol className="mono-more-list" aria-label={t('mono.nav.moreTitle')}>
          {ENTRIES.map((e, i) => {
            const on = tab === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpen(e.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`mono-more-item${on ? ' is-on' : ''}`}
                >
                  <span className="mono-more-num" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="mono-more-copy">
                    <span className="mono-h3">{t(e.label)}</span>
                    <span className="mono-meta">{t(e.hint)}</span>
                  </span>
                  <span className="mono-more-chev" aria-hidden>
                    {on ? '●' : '›'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <nav className="mono-more-legal" aria-label={t('foot.help')}>
          <Link to="/help">{t('foot.help')}</Link>
          <Link to="/privacy">{t('foot.privacy')}</Link>
          <Link to="/terms">{t('foot.terms')}</Link>
        </nav>
      </div>
    </div>
  );
}
