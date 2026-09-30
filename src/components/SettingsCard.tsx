import type { Settings, SoundType } from '../lib/store';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  playSound,
  BUILT_IN_SOUNDS,
  saveCustomSound,
  loadCustomSound,
  deleteCustomSound,
  type BuiltInSound,
} from '../lib/soundEngine';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  ACCENT_PRESETS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  THEME_OPTIONS,
  isProFont,
  type AccentName,
  type FontChoice,
  type FontScale,
  type ThemeName,
  type UITheme,
} from '../lib/theme';
import {
  ATMOSPHERES,
  ATMOSPHERE_LABEL,
  isProAtmosphere,
  type Atmosphere,
} from '../mono/atmosphere';
import { loadCelebratePrefs, saveCelebratePrefs, type CelebratePrefs } from '../lib/moments';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro?: boolean;
  /** Focus color atmosphere — classic free; Pro packs gated. */
  atmosphere: Atmosphere;
  onAtmosphere: (atmosphere: Atmosphere) => void;
  /** Signed in with cloud sync on — timer settings are part of the synced scope. */
  synced?: boolean;
}

type NumKey = 'focusMin' | 'shortMin' | 'longMin' | 'longEvery' | 'dailyGoal';

const SOUND_TKEYS: Record<BuiltInSound, TKey> = {
  bell: 'set.sound.bell',
  gong: 'set.sound.gong',
  piano: 'set.sound.piano',
  birds: 'set.sound.birds',
  gentle: 'set.sound.gentle',
  rain: 'set.sound.rain',
  ocean: 'set.sound.ocean',
};

const LIMITS: Record<NumKey, { min: number; max: number }> = {
  focusMin: { min: 1, max: 120 },
  shortMin: { min: 1, max: 60 },
  longMin: { min: 1, max: 90 },
  longEvery: { min: 2, max: 8 },
  dailyGoal: { min: 1, max: 20 },
};

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Stepper({
  label,
  value,
  unit,
  hint,
  field,
  accent,
  onStep,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  field: NumKey;
  accent?: boolean;
  onStep: (field: NumKey, delta: number) => void;
}) {
  const { t } = useI18n();
  const { min, max } = LIMITS[field];
  const btn = 'mono-btn mono-btn-ghost mono-btn-icon';
  return (
    <div className="mono-set-row">
      <div className="mono-set-copy">
        <div
          className="mono-set-label"
          style={accent ? { color: 'var(--mono-accent)' } : undefined}
        >
          {label}
        </div>
        <div className="mono-set-hint">{hint}</div>
      </div>
      <div className="mono-set-ctl">
        <button
          className={btn}
          onClick={() => onStep(field, -1)}
          disabled={value <= min}
          aria-label={t('set.dec', { label })}
        >
          <MinusIcon />
        </button>
        <span className="mono-set-value">
          {value}
          <small>{unit}</small>
        </span>
        <button
          className={btn}
          onClick={() => onStep(field, 1)}
          disabled={value >= max}
          aria-label={t('set.inc', { label })}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onClick,
}: {
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="mono-set-row mono-set-toggle"
    >
      <span className="mono-set-copy">
        <span className="mono-set-label">{label}</span>
        <span className="mono-set-hint">{hint}</span>
      </span>
      <span className="mono-switch" aria-hidden="true" />
    </button>
  );
}

export default function SettingsCard({
  settings,
  onChange,
  theme,
  onThemeChange,
  isPro = false,
  atmosphere,
  onAtmosphere,
  synced = false,
}: Props) {
  const { t } = useI18n();
  return (
    <section className="mono-card mono-panel" aria-label={t('set.aria')}>
      <header className="mono-between" style={{ gap: 12 }}>
        <h2 className="mono-h2">{t('set.title')}</h2>
        <span className="mono-caption">{t(synced ? 'set.savedSynced' : 'set.saved')}</span>
      </header>
      <TimerSettings settings={settings} onChange={onChange} />
      <div style={{ borderTop: '1px solid var(--mono-border)' }}>
        <AlertSettings settings={settings} onChange={onChange} />
      </div>
      <div style={{ borderTop: '1px solid var(--mono-border)' }}>
        <SectionLabel text={t('set.theme')} />
        <AppearanceSettings
          theme={theme}
          onThemeChange={onThemeChange}
          isPro={isPro}
          atmosphere={atmosphere}
          onAtmosphere={onAtmosphere}
        />
      </div>
    </section>
  );
}

interface TimerProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

/** Focus / break lengths, long-break cycle, daily goal, weekly capacity. */
export function TimerSettings({ settings, onChange }: TimerProps) {
  const { t, tp } = useI18n();

  const step = (field: NumKey, delta: number) => {
    const { min, max } = LIMITS[field];
    const next = Math.min(max, Math.max(min, settings[field] + delta));
    if (next !== settings[field]) onChange({ [field]: next } as Partial<Settings>);
  };

  return (
    <div className="mono-set-rows">
      <Stepper
        label={t('set.s.focus')}
        hint={t('set.s.focusH')}
        value={settings.focusMin}
        unit={t('set.unit.min')}
        field="focusMin"
        accent
        onStep={step}
      />
      <Stepper
        label={t('set.s.short')}
        hint={t('set.s.shortH')}
        value={settings.shortMin}
        unit={t('set.unit.min')}
        field="shortMin"
        onStep={step}
      />
      <Stepper
        label={t('set.s.long')}
        hint={t('set.s.longH')}
        value={settings.longMin}
        unit={t('set.unit.min')}
        field="longMin"
        onStep={step}
      />
      <Stepper
        label={t('set.s.cycle')}
        hint={t('set.s.cycleH')}
        value={settings.longEvery}
        unit={tp('set.unit.round', settings.longEvery)}
        field="longEvery"
        onStep={step}
      />
      <Stepper
        label={t('set.s.goal')}
        hint={t('set.s.goalH')}
        value={settings.dailyGoal}
        unit={tp('set.unit.session', settings.dailyGoal)}
        field="dailyGoal"
        onStep={step}
      />
      <div className="mono-set-row">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.cap')}</div>
          <div className="mono-set-hint">{t('set.capH')}</div>
        </div>
        <div className="mono-set-ctl">
          <button
            onClick={() =>
              onChange({ weeklyCapacityMin: Math.max(60, settings.weeklyCapacityMin - 60) })
            }
            className="mono-btn mono-btn-ghost mono-btn-icon"
            disabled={settings.weeklyCapacityMin <= 60}
            aria-label={t('set.capDec')}
          >
            <MinusIcon />
          </button>
          <span className="mono-set-value">{Math.round(settings.weeklyCapacityMin / 60)}h</span>
          <button
            onClick={() =>
              onChange({ weeklyCapacityMin: Math.min(10080, settings.weeklyCapacityMin + 60) })
            }
            className="mono-btn mono-btn-ghost mono-btn-icon"
            disabled={settings.weeklyCapacityMin >= 10080}
            aria-label={t('set.capInc')}
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Auto-start, celebrations, completion sound (built-in or custom), notifications. */
export function AlertSettings({ settings, onChange }: TimerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCustom, setHasCustom] = useState(false);
  const [celebrate, setCelebrate] = useState<CelebratePrefs>(loadCelebratePrefs);

  useEffect(() => {
    if (settings.soundType !== 'custom') return;
    let cancelled = false;
    void loadCustomSound().then((buf) => {
      if (!cancelled) setHasCustom(Boolean(buf));
    });
    return () => {
      cancelled = true;
    };
  }, [settings.soundType]);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'].includes(file.type) &&
      !/\.(mp3|wav|webm|ogg)$/i.test(file.name)
    ) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data === 'object' && data !== null) {
        void saveCustomSound(data).then(() => {
          setHasCustom(Boolean(data));
          playSound('custom', settings.volume / 100);
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRemoveCustom = () => {
    void deleteCustomSound().then(() => setHasCustom(false));
  };

  return (
    <div className="mono-set-rows">
      <Toggle
        label={t('set.auto')}
        hint={t('set.autoH')}
        on={settings.autoStart}
        onClick={() => onChange({ autoStart: !settings.autoStart })}
      />
      <Toggle
        label={t('mono.celebrate.setting')}
        hint={t('mono.celebrate.settingH')}
        on={celebrate.enabled}
        onClick={() => {
          const next = { enabled: !celebrate.enabled };
          setCelebrate(next);
          saveCelebratePrefs(next);
        }}
      />
      <Toggle
        label={t('set.chime')}
        hint={t('set.chimeH')}
        on={settings.sound}
        onClick={() => onChange({ sound: !settings.sound })}
      />
      {settings.sound && (
        <>
          <div className="mono-set-row">
            <div className="mono-set-copy">
              <div className="mono-set-label">{t('set.soundType')}</div>
              <div className="mono-set-hint">{t('set.soundTypeH')}</div>
            </div>
            <div className="mono-set-ctl">
              <select
                value={settings.soundType}
                onChange={(e) => onChange({ soundType: e.target.value as SoundType })}
                className="mono-field mono-field-sm mono-field-auto"
              >
                {BUILT_IN_SOUNDS.map((s) => (
                  <option key={s} value={s}>
                    {t(SOUND_TKEYS[s])}
                  </option>
                ))}
                <option value="custom">{t('set.sound.custom')}</option>
              </select>
              <button
                onClick={() => {
                  if (settings.soundType === 'custom' && !hasCustom) return;
                  playSound(settings.soundType, settings.volume / 100);
                }}
                className="mono-btn mono-btn-ghost mono-btn-icon"
                aria-label={t('set.preview')}
                title={t('set.preview')}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
          </div>
          {settings.soundType === 'custom' && (
            <div className="mono-set-row">
              <div className="mono-set-copy">
                <div className="mono-set-label">{t('set.customUp')}</div>
                <div className="mono-set-hint">
                  {hasCustom ? t('set.customHas') : t('set.customFormats')}
                </div>
              </div>
              <div className="mono-set-ctl">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.webm"
                  className="hidden"
                  onChange={handleUpload}
                />
                {hasCustom ? (
                  <>
                    <button
                      onClick={() => handleRemoveCustom()}
                      className="mono-btn mono-btn-ghost mono-btn-sm"
                    >
                      {t('set.remove')}
                    </button>
                    <button
                      onClick={() => playSound('custom', settings.volume / 100)}
                      className="mono-btn mono-btn-ghost mono-btn-sm"
                    >
                      {t('set.test')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mono-btn mono-btn-ghost mono-btn-sm"
                  >
                    {t('set.upload')}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="mono-set-row">
            <div className="mono-set-copy">
              <div className="mono-set-label">{t('set.volume')}</div>
              <div className="mono-set-hint">{t('set.volumeH')}</div>
            </div>
            <div className="mono-set-ctl">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={(e) => onChange({ volume: parseInt(e.target.value) })}
                style={{ width: 128, accentColor: 'var(--mono-accent)' }}
              />
              <span className="mono-caption" style={{ width: 40, textAlign: 'right' }}>
                {settings.volume}%
              </span>
            </div>
          </div>
          <Toggle
            label={t('set.browser')}
            hint={t('set.browserH')}
            on={settings.notifications}
            onClick={() => onChange({ notifications: !settings.notifications })}
          />
        </>
      )}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="mono-set-row">
      <div className="mono-set-label">{text}</div>
      <span className="mono-caption">{t('set.appearance')}</span>
    </div>
  );
}

function Chip({
  selected,
  disabled,
  locked,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  /** Soft lock: still clickable (e.g. open /pricing), muted look. */
  locked?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="mono-chip mono-chip-sm"
      style={locked && !selected ? { opacity: 0.6 } : undefined}
    >
      {children}
    </button>
  );
}

const FONT_LABEL_KEYS: Record<FontChoice, TKey> = {
  default: 'set.font.default',
  inter: 'set.font.inter',
  literata: 'set.font.literata',
  'source-serif': 'set.font.sourceSerif',
  'cal-sans': 'set.font.calSans',
  jetbrains: 'set.font.jetbrains',
  fraunces: 'set.font.fraunces',
  'dm-sans': 'set.font.dmSans',
  lora: 'set.font.lora',
  'ibm-plex': 'set.font.ibmPlex',
  manrope: 'set.font.manrope',
  spectral: 'set.font.spectral',
  outfit: 'set.font.outfit',
  crimson: 'set.font.crimson',
  'space-grotesk': 'set.font.spaceGrotesk',
  newsreader: 'set.font.newsreader',
};

/** Atmosphere, light/dark, accent, font, text size. */
export function AppearanceSettings({
  theme,
  onThemeChange,
  isPro,
  atmosphere,
  onAtmosphere,
}: {
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro: boolean;
  atmosphere: Atmosphere;
  onAtmosphere: (atmosphere: Atmosphere) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const set = (patch: Partial<UITheme>) => onThemeChange({ ...theme, ...patch });

  const pickFont = (f: FontChoice) => {
    if (isProFont(f) && !isPro) {
      navigate('/pricing');
      return;
    }
    set({ font: f });
  };

  const pickAtmosphere = (id: Atmosphere) => {
    if (isProAtmosphere(id) && !isPro) {
      navigate('/pricing');
      return;
    }
    onAtmosphere(id);
  };

  return (
    <div className="mono-set-rows">
      <div className="mono-set-row mono-set-row-col">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.atm')}</div>
          <div className="mono-set-hint">{isPro ? t('set.atmPro') : t('set.atmFree')}</div>
          {!isPro && (
            <Link to="/pricing" className="mono-link-btn" style={{ minHeight: 32, fontSize: 14 }}>
              {t('set.atmUpgrade')}
            </Link>
          )}
        </div>
        <div className="mono-inline" style={{ gap: 6 }} role="group" aria-label={t('set.atm')}>
          {ATMOSPHERES.map((id) => {
            const locked = isProAtmosphere(id) && !isPro;
            return (
              <Chip
                key={id}
                selected={atmosphere === id}
                locked={locked}
                onClick={() => pickAtmosphere(id)}
              >
                {t(ATMOSPHERE_LABEL[id])}
                {locked && ' · Pro'}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="mono-set-row mono-set-row-wrap">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.mode')}</div>
          <div className="mono-set-hint">{isPro ? t('set.modePro') : t('set.modeFree')}</div>
        </div>
        <div className="mono-set-ctl">
          {THEME_OPTIONS.map((opt) => (
            <Chip
              key={opt}
              selected={theme.theme === opt}
              disabled={opt === 'light' && !isPro}
              onClick={() => set({ theme: opt as ThemeName })}
            >
              {opt === 'light' ? t('set.theme.light') : t('set.theme.dark')}
              {opt === 'light' && !isPro && ' · Pro'}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mono-set-row mono-set-row-col">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.accent')}</div>
          <div className="mono-set-hint">{isPro ? t('set.accentPro') : t('set.accentFree')}</div>
        </div>
        <div className="mono-inline" style={{ gap: 6 }}>
          {(
            [
              'auto',
              ...(Object.keys(ACCENT_PRESETS) as Array<keyof typeof ACCENT_PRESETS>),
            ] as AccentName[]
          )
            .reverse()
            .map((k) => {
              const isAuto = k === 'auto';
              const active = theme.accent === k;
              return (
                <button
                  key={k}
                  onClick={() => (isPro ? set({ accent: k }) : undefined)}
                  disabled={!isPro}
                  aria-pressed={active}
                  className="mono-swatch"
                  style={{
                    background: isAuto
                      ? 'var(--mono-bg-2)'
                      : ACCENT_PRESETS[k as Exclude<AccentName, 'auto'>].accent,
                  }}
                  title={String(k)}
                  aria-label={t('set.accentAria', { k })}
                >
                  {isAuto ? 'A' : ''}
                </button>
              );
            })}
        </div>
      </div>

      <div className="mono-set-row mono-set-row-col">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.font')}</div>
          <div className="mono-set-hint">{isPro ? t('set.fontPro') : t('set.fontFree')}</div>
          {!isPro && (
            <Link to="/pricing" className="mono-link-btn" style={{ minHeight: 32, fontSize: 14 }}>
              {t('set.fontUpgrade')}
            </Link>
          )}
        </div>
        <div className="mono-inline" style={{ gap: 6 }}>
          {FONT_OPTIONS.map((f) => {
            const locked = isProFont(f) && !isPro;
            return (
              <Chip key={f} selected={theme.font === f} locked={locked} onClick={() => pickFont(f)}>
                {t(FONT_LABEL_KEYS[f])}
                {locked && ' · Pro'}
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="mono-set-row mono-set-row-wrap">
        <div className="mono-set-copy">
          <div className="mono-set-label">{t('set.size')}</div>
          <div className="mono-set-hint">{t('set.sizeH')}</div>
        </div>
        <div className="mono-set-ctl">
          {FONT_SCALE_OPTIONS.map((s) => (
            <Chip
              key={s}
              selected={theme.fontScale === s}
              onClick={() => set({ fontScale: s as FontScale })}
            >
              {s === 'normal'
                ? t('set.scale.normal')
                : s === 'comfort'
                  ? t('set.scale.comfort')
                  : t('set.scale.compact')}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
