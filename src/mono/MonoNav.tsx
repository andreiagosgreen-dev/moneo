import { lazy, Suspense } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const AccountButton = lazy(() => import('../components/AccountButton'));

/**
 * Mono navigation: primary modules in the left rail; Account + Settings below.
 * Mobile keeps a compact bottom bar (core + More overflow).
 */
export type MonoTab =
  | 'focus'
  | 'today'
  | 'orar'
  | 'projects'
  | 'reports'
  | 'plan'
  | 'growth'
  | 'map'
  | 'graph'
  | 'settings'
  | 'more';

interface Item {
  id: MonoTab;
  label: TKey;
  icon: string;
  /** Hidden on mobile bottom bar — available via More / desktop rail. */
  deskOnly?: boolean;
}

const PRIMARY: Item[] = [
  {
    id: 'focus',
    label: 'mono.nav.focus',
    icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  },
  {
    id: 'today',
    label: 'mono.nav.azi',
    icon: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  },
  {
    id: 'orar',
    label: 'mono.nav.orar',
    icon: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M7 4v5M12 4v17M17 4v17"/>',
  },
  {
    id: 'projects',
    label: 'mono.nav.proiecte',
    icon: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  },
  {
    id: 'reports',
    label: 'mono.nav.rapoarte',
    icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  },
  {
    id: 'plan',
    label: 'nav.plan',
    icon: '<path d="M4 6h16M4 12h10M4 18h14"/><circle cx="19" cy="12" r="2"/>',
    deskOnly: true,
  },
  {
    id: 'growth',
    label: 'nav.growth',
    icon: '<path d="M4 20V10M10 20V6M16 20v-4M20 4l-4 4"/>',
    deskOnly: true,
  },
  {
    id: 'map',
    label: 'nav.map',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
    deskOnly: true,
  },
  {
    id: 'graph',
    label: 'nav.graph',
    icon: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.2 7.2l7.4-.2M7.3 8.2l3.6 7.6M16.9 9.2l-3.8 6.8"/>',
    deskOnly: true,
  },
  {
    id: 'more',
    label: 'mono.nav.more',
    icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  },
];

/** Every navigable destination (for the ⌘K palette) — rail items minus the mobile overflow. */
export const MONO_NAV_ITEMS: ReadonlyArray<{ id: MonoTab; label: TKey }> = [
  ...PRIMARY.filter((it) => it.id !== 'more').map(({ id, label }) => ({ id, label })),
  { id: 'settings', label: 'nav.settingsLabel' },
];

interface Props {
  tab: MonoTab;
  onTab: (t: MonoTab) => void;
  onNewSession: () => void;
  /** Opens the ⌘K command palette. */
  onOpenPalette?: () => void;
}

export default function MonoNav({ tab, onTab, onNewSession, onOpenPalette }: Props) {
  const { t } = useI18n();
  // Plan/Growth/Map are first-class rail items — do not keep More highlighted
  // when they are open (that made two aria-selected tabs on desktop).
  const isActive = (id: MonoTab): boolean => tab === id;

  return (
    <nav className="mono-nav" role="tablist" aria-label={t('mono.nav.aria')}>
      <div className="mono-rail-brand">
        <img
          className="mono-rail-mark"
          src="/brand/moneo-mark-1200.png"
          alt=""
          width={22}
          height={22}
          decoding="async"
        />
        <span className="mono-rail-name">Moneo</span>
      </div>

      <div className="mono-rail-primary">
        {PRIMARY.map((it) => {
          const on = isActive(it.id);
          return (
            <button
              key={it.id}
              role="tab"
              aria-selected={on}
              onClick={() => onTab(it.id)}
              className={`mono-nav-item${on ? ' active' : ''}${it.deskOnly ? ' is-desk-only' : ''}${it.id === 'more' ? ' is-mobile-more' : ''}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden dangerouslySetInnerHTML={{ __html: it.icon }} />
              {t(it.label)}
            </button>
          );
        })}
      </div>

      <div className="mono-rail-foot">
        <div className="mono-rail-foot-identity">
          <p className="mono-eyebrow mono-rail-kicker">{t('mono.nav.account')}</p>
          <div className="mono-rail-account">
            <Suspense fallback={null}>
              <AccountButton />
            </Suspense>
          </div>
        </div>

        <div className="mono-rail-tools">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'settings'}
            onClick={() => onTab('settings')}
            className={`mono-nav-item mono-rail-tool${tab === 'settings' ? ' active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              dangerouslySetInnerHTML={{
                __html:
                  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
              }}
            />
            <span className="mono-rail-item-label">{t('mono.nav.settings')}</span>
          </button>
          {onOpenPalette && (
            <button
              type="button"
              onClick={onOpenPalette}
              title={`${t('palette.title')} (⌘K)`}
              className="mono-nav-item mono-rail-tool"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                dangerouslySetInnerHTML={{
                  __html: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
                }}
              />
              <span className="mono-rail-item-label">{t('mono.nav.palette')}</span>
              <kbd className="mono-rail-kbd">⌘K</kbd>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNewSession}
          className="mono-btn mono-btn-primary mono-btn-block mono-rail-new"
        >
          {t('mono.nav.newSession')}
        </button>

        <p className="mono-rail-tag">{t('foot.tag')}</p>
      </div>
    </nav>
  );
}
