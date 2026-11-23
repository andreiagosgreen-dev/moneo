import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertSettings, AppearanceSettings, TimerSettings } from '../components/SettingsCard';
import {
  BYOK_PROVIDERS,
  loadByokConfig,
  saveByokConfig,
  type ByokConfig,
  type ByokProvider,
} from '../lib/ai/byok';
import { canUseByokAi } from '../lib/billing/pricingConfig';
import type { TKey } from '../lib/i18n/types';
import LanguageCard from '../components/LanguageCard';
import PricingCard from '../components/PricingCard';
import MonoPlanEntitlements from './MonoPlanEntitlements';
import { currentPlanOf } from '../lib/billing/entitlements';
import { useAuth } from '../lib/authProvider';
import { isCancelledButActive } from '../lib/cloud/subscriptionRepository';
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
      <AiKeyGroup isPro={isPro} />
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
        <div className="mono-set-stack">
          <PlanEntitlements isPro={isPro} />
          <PricingCard />
        </div>
      </Group>
      <Group id="help" title={t('legal.cardTitle')} hint={t('set.grp.helpSum')}>
        <MonoSupportCard hideTitle />
      </Group>
    </div>
  );
}

/** Reads the subscription only when the Plan group is open (needs AuthProvider). */
function PlanEntitlements({ isPro }: { isPro: boolean }) {
  const { subscription, trialEndsAt } = useAuth();
  const current = currentPlanOf(isPro, subscription, trialEndsAt != null);
  return (
    <MonoPlanEntitlements
      current={current}
      activeUntil={
        current === 'pro-trial'
          ? (trialEndsAt ?? null)
          : isCancelledButActive(subscription)
            ? subscription.currentPeriodEnd
            : null
      }
    />
  );
}

const PROVIDER_KEY: Record<ByokProvider, TKey> = {
  local: 'assist.roadmap.provider.local',
  gemini: 'assist.roadmap.provider.gemini',
  openai: 'assist.roadmap.provider.openai',
  deepseek: 'assist.roadmap.provider.deepseek',
};

function AiKeyGroup({ isPro }: { isPro: boolean }) {
  const { t } = useI18n();
  const byokOk = canUseByokAi(isPro);
  const [cfg, setCfg] = useState<ByokConfig>(() => loadByokConfig());
  const persist = (next: ByokConfig) => {
    setCfg(next);
    saveByokConfig(next);
  };
  const providerLabel = t(PROVIDER_KEY[byokOk ? cfg.provider : 'local']);
  const hint =
    byokOk && cfg.provider !== 'local' && cfg.key ? `${providerLabel} · ✓` : providerLabel;

  return (
    <Group id="ai" title="Moneo AI" hint={hint}>
      <div className="mono-stack" style={{ gap: 10 }}>
        {!byokOk ? (
          <div className="mono-between" style={{ gap: 10, flexWrap: 'wrap' }}>
            <p className="mono-caption" style={{ margin: 0, flex: '1 1 200px' }}>
              {t('assist.roadmap.byokPro')}
            </p>
            <Link to="/pricing" className="mono-btn mono-btn-primary mono-btn-sm">
              {t('pay.upgrade')} →
            </Link>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="mono-stack mono-caption" style={{ gap: 4 }}>
            {t('assist.roadmap.provider')}
            <select
              value={byokOk ? cfg.provider : 'local'}
              disabled={!byokOk}
              onChange={(e) => persist({ ...cfg, provider: e.target.value as ByokProvider })}
              className="mono-field mono-field-sm"
            >
              {(byokOk ? BYOK_PROVIDERS : (['local'] as ByokProvider[])).map((p) => (
                <option key={p} value={p}>
                  {t(PROVIDER_KEY[p])}
                </option>
              ))}
            </select>
          </label>
          <label className="mono-stack mono-caption" style={{ gap: 4 }}>
            {t('assist.roadmap.apiKey')}
            <input
              type="password"
              autoComplete="off"
              value={cfg.key}
              disabled={!byokOk || cfg.provider === 'local'}
              onChange={(e) => persist({ ...cfg, key: e.target.value })}
              placeholder={t('assist.roadmap.apiKeyPh')}
              className="mono-field mono-field-sm"
            />
          </label>
        </div>
        {byokOk ? (
          <div className="mono-inline" style={{ gap: 8 }}>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-btn mono-btn-ghost mono-btn-sm"
            >
              {t('assist.roadmap.guide.open')}
            </a>
            {cfg.provider !== 'gemini' ? (
              <button
                type="button"
                onClick={() => persist({ ...cfg, provider: 'gemini' })}
                className="mono-btn mono-btn-ghost mono-btn-sm"
              >
                {t('assist.roadmap.guide.useGemini')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Group>
  );
}
