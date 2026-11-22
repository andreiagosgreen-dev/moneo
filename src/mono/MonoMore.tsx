import { Link } from 'react-router-dom';
import MonoHead from './MonoHead';
import { useAuth } from '../lib/authProvider';
import MonoLegalLinks from './MonoLegalLinks';
import { MonoTabIcon, type MonoTab } from './MonoNav';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Entry {
  id: Extract<MonoTab, 'plan' | 'growth' | 'move' | 'map' | 'graph' | 'settings'>;
  label: TKey;
  hint: TKey;
}

/** Mobile overflow: visual 2-column hub with icons. Desktop has these in the rail. */
const ENTRIES: Entry[] = [
  { id: 'plan', label: 'nav.plan', hint: 'nav.hint.plan' },
  { id: 'move', label: 'nav.move', hint: 'nav.hint.move' },
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
  const signedIn = useAuth().status === 'authenticated';
  return (
    <div className="mono-more">
      <MonoHead eyebrow={t('mono.nav.more')} title={t('mono.nav.moreTitle')} />

      <div className="mono-more-col mono-pad">
        <ul className="mono-more-list" aria-label={t('mono.nav.moreTitle')}>
          {ENTRIES.map((e) => {
            const on = tab === e.id;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpen(e.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`mono-more-item${on ? ' is-on' : ''}`}
                >
                  <span className="mono-more-icon" aria-hidden="true">
                    <MonoTabIcon id={e.id} />
                  </span>
                  <span className="mono-more-copy">
                    <span className="mono-h3">{t(e.label)}</span>
                    <span className="mono-meta">{t(e.hint)}</span>
                  </span>
                  <span className="mono-more-chev" aria-hidden="true">
                    {on ? '●' : '›'}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="mono-more-wide">
            <Link to={signedIn ? '/account' : '/login'} className="mono-more-item no-underline">
              <span className="mono-more-icon" aria-hidden="true">
                <MonoTabIcon id="account" />
              </span>
              <span className="mono-more-copy">
                <span className="mono-h3">{t('mono.more.account')}</span>
                <span className="mono-meta">
                  {t(signedIn ? 'mono.more.accountHint' : 'mono.more.signInHint')}
                </span>
              </span>
              <span className="mono-more-chev" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        </ul>

        <MonoLegalLinks showAbout showHelp />
      </div>
    </div>
  );
}
