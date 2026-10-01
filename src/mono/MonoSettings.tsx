import type { ReactNode } from 'react';
import { AlertSettings, AppearanceSettings, TimerSettings } from '../components/SettingsCard';
import LanguageCard from '../components/LanguageCard';
import PricingCard from '../components/PricingCard';
import MonoCloudSync from './MonoCloudSync';
import MonoDataExport from './MonoDataExport';
import MonoLocalData from './MonoLocalData';
import MonoSupportCard from './MonoSupportCard';
import { ATMOSPHERE_LABEL, type Atmosphere } from './atmosphere';
import { useI18n } from '../lib/i18n/LocaleContext';
import { LOCALES } from '../lib/i18n';
import type { Settings } from '../lib/store';
import type { UITheme } from '../lib/theme';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro: boolean;
  atmosphere: Atmosphere;
  onAtmosphere: (atmosphere: Atmosphere) => void;
  /** Signed in with cloud sync on. */
  synced: boolean;
  signedIn: boolean;
  user: { userId: string; email: string | null } | null;
}

function Group({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <details className="mono-set-group" data-testid={`set-${id}`}>
      <summary className="mono-set-summary">
        <span className="mono-tpl-summary-copy">
          <span className="mono-h3">{title}</span>
          <span className="mono-meta">{hint}</span>
        </span>
        <span className="mono-tpl-chev" aria-hidden>
          ›
        </span>
      </summary>
      <div className="mono-set-body">{children}</div>
    </details>
  );
}

/** Settings tab: collapsed groups, each summary shows the current values. */
export default function MonoSettings({
  settings,
  onChange,
  theme,
  onThemeChange,
  isPro,
  atmosphere,
  onAtmosphere,
  synced,
  signedIn,
  user,
}: Props) {
  const { t, locale } = useI18n();
  const language = LOCALES.find((l) => l.id === locale)?.native ?? locale;
  const mode = t(theme.theme === 'light' ? 'set.theme.light' : 'set.theme.dark');

  return (
    <div className="mono-set">
      <p className="mono-meta">{t(synced ? 'set.savedSynced' : 'set.saved')}</p>
      <Group
        id="timer"
        title={t('set.grp.timer')}
        hint={t('set.grp.timerSum', {
          focus: settings.focusMin,
          short: settings.shortMin,
          goal: settings.dailyGoal,
        })}
      >
        <TimerSettings settings={settings} onChange={onChange} />
      </Group>
      <Group
        id="alerts"
        title={t('set.grp.alerts')}
        hint={
          settings.sound ? t('set.grp.alertsOn', { vol: settings.volume }) : t('set.grp.alertsOff')
        }
      >
        <AlertSettings settings={settings} onChange={onChange} />
      </Group>
      <Group
        id="look"
        title={t('set.appearance')}
        hint={`${t(ATMOSPHERE_LABEL[atmosphere])} · ${t('set.theme')}: ${mode}`}
      >
        <AppearanceSettings
          theme={theme}
          onThemeChange={onThemeChange}
          isPro={isPro}
          atmosphere={atmosphere}
          onAtmosphere={onAtmosphere}
        />
      </Group>
      <Group id="lang" title={t('settings.langTitle')} hint={language}>
        <LanguageCard />
      </Group>
      <Group id="data" title={t('set.grp.data')} hint={t('set.grp.dataSum')}>
        <div className="mono-set-stack">
          {signedIn ? <MonoCloudSync isPro={isPro} /> : null}
          <MonoDataExport user={user} />
          <MonoLocalData signedIn={signedIn} />
        </div>
      </Group>
      <Group
        id="plan"
        title={t('set.grp.plan')}
        hint={t(isPro ? 'set.grp.planPro' : 'set.grp.planFree')}
      >
        <PricingCard />
      </Group>
      <Group id="help" title={t('legal.cardTitle')} hint={t('set.grp.helpSum')}>
        <MonoSupportCard hideTitle />
      </Group>
    </div>
  );
}
