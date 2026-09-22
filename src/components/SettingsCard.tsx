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
interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro?: boolean;
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
  const btn =
    'press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25 disabled:pointer-events-none';
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div
          className={`text-[14px] font-semibold ${accent ? '' : 'text-cream/90'}`}
          style={accent ? { color: 'var(--accent)' } : undefined}
        >
          {label}
        </div>
        <div className="text-[12px] text-faint">{hint}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          className={btn}
          onClick={() => onStep(field, -1)}
          disabled={value <= min}
          aria-label={t('set.dec', { label })}
        >
          <MinusIcon />
        </button>
        <span className="inline-flex min-w-20 items-baseline justify-center gap-0.5 rounded-lg bg-ink/60 px-2 py-1 font-mono text-sm font-semibold text-cream ring-1 ring-inset ring-line">
          {value}
          <span className="text-[11px] font-medium text-faint">{unit}</span>
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
      className="press group flex w-full items-center justify-between gap-3 rounded-xl px-1 py-3 text-left"
    >
      <span>
        <span className="block text-[14px] font-semibold text-cream/90">{label}</span>
        <span className="block text-[12px] text-faint">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
          on ? '' : 'settle-track'
        }`}
        style={{
          background: on ? 'var(--accent)' : undefined,
          boxShadow: on ? '0 0 14px rgb(var(--accent-rgb) / 0.5)' : 'none',
        }}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-all duration-300 ${
            on ? '' : 'settle-thumb-off'
          }`}
          style={{
            left: on ? 'calc(100% - 1.375rem)' : '0.125rem',
            background: on ? 'var(--on-accent)' : undefined,
          }}
        />
      </span>
    </button>
  );
}

export default function SettingsCard({
  settings,
  onChange,
  theme,
  onThemeChange,
  isPro = false,
}: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCustom, setHasCustom] = useState(false);

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

  const step = (field: NumKey, delta: number) => {
    const { min, max } = LIMITS[field];
    const next = Math.min(max, Math.max(min, settings[field] + delta));
    if (next !== settings[field]) onChange({ [field]: next } as Partial<Settings>);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('set.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('set.title')}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          {t('set.saved')}
        </span>
      </header>

      <div className="mt-3 divide-y divide-line/70">
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
          unit={t('set.unit.rnd')}
          field="longEvery"
          onStep={step}
        />
        <Stepper
          label={t('set.s.goal')}
          hint={t('set.s.goalH')}
          value={settings.dailyGoal}
          unit={t('set.unit.ses')}
          field="dailyGoal"
          onStep={step}
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-cream/90">{t('set.cap')}</div>
            <div className="text-[12px] text-faint">{t('set.capH')}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() =>
                onChange({ weeklyCapacityMin: Math.max(60, settings.weeklyCapacityMin - 60) })
              }
              className="press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25 disabled:pointer-events-none"
              disabled={settings.weeklyCapacityMin <= 60}
              aria-label={t('set.capDec')}
            >
              <MinusIcon />
            </button>
            <span className="w-14 text-center font-mono text-[13px] text-cream">
              {Math.round(settings.weeklyCapacityMin / 60)}h
            </span>
            <button
              onClick={() =>
                onChange({ weeklyCapacityMin: Math.min(10080, settings.weeklyCapacityMin + 60) })
              }
              className="press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25 disabled:pointer-events-none"
              disabled={settings.weeklyCapacityMin >= 10080}
              aria-label={t('set.capInc')}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 divide-y divide-line/70 border-t border-line">
        <Toggle
          label={t('set.auto')}
          hint={t('set.autoH')}
          on={settings.autoStart}
          onClick={() => onChange({ autoStart: !settings.autoStart })}
        />
        <Toggle
          label={t('set.chime')}
          hint={t('set.chimeH')}
          on={settings.sound}
          onClick={() => onChange({ sound: !settings.sound })}
        />
        {settings.sound && (
          <>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">{t('set.soundType')}</div>
                <div className="text-[12px] text-faint">{t('set.soundTypeH')}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={settings.soundType}
                  onChange={(e) => onChange({ soundType: e.target.value as SoundType })}
                  className="min-w-32 rounded-lg bg-ink/60 px-3 py-2 text-sm font-semibold text-cream ring-1 ring-inset ring-line"
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
                  className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/60 text-cream/70 ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
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
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-cream/90">{t('set.customUp')}</div>
                  <div className="text-[12px] text-faint">
                    {hasCustom ? t('set.customHas') : t('set.customFormats')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
                        className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                      >
                        {t('set.remove')}
                      </button>
                      <button
                        onClick={() => playSound('custom', settings.volume / 100)}
                        className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                      >
                        {t('set.test')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                    >
                      {t('set.upload')}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">{t('set.volume')}</div>
                <div className="text-[12px] text-faint">{t('set.volumeH')}</div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.volume}
                  onChange={(e) => onChange({ volume: parseInt(e.target.value) })}
                  className="w-32 accent-current"
                />
                <span className="font-mono text-[12px] text-faint w-8 text-right">
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

      <AppearanceSection theme={theme} onThemeChange={onThemeChange} isPro={isPro} />
    </section>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="text-[14px] font-semibold text-cream/90">{text}</div>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        {t('set.appearance')}
      </span>
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
      className={`press rounded-lg px-3 py-1.5 font-mono text-[12px] font-semibold ring-1 transition-colors disabled:cursor-not-allowed ${
        selected
          ? 'bg-ink/70 text-cream ring-accent'
          : disabled || locked
            ? 'text-faint ring-line opacity-60'
            : 'text-sage ring-line hover:text-cream hover:ring-accent/50'
      }`}
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
};

function AppearanceSection({
  theme,
  onThemeChange,
  isPro,
}: {
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro: boolean;
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

  return (
    <div className="mt-2 divide-y divide-line/70 border-t border-line">
      <SectionLabel text={t('set.theme')} />

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">{t('set.mode')}</div>
          <div className="text-[12px] text-faint">
            {isPro ? t('set.modePro') : t('set.modeFree')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">{t('set.accent')}</div>
          <div className="text-[12px] text-faint">
            {isPro ? t('set.accentPro') : t('set.accentFree')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
                  className="press flex h-7 min-w-7 items-center justify-center rounded-full p-0.5 disabled:cursor-not-allowed"
                  style={{
                    background: isAuto
                      ? undefined
                      : ACCENT_PRESETS[k as Exclude<AccentName, 'auto'>].accent,
                  }}
                  title={String(k)}
                  aria-label={t('set.accentAria', { k })}
                >
                  <span
                    className={`flex h-full w-full items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                      active ? 'bg-cream text-ink shadow ring-1 ring-line' : 'bg-transparent'
                    }`}
                    style={
                      isAuto
                        ? {
                            background: active ? 'var(--color-cream)' : 'var(--color-ink)',
                            border: '1px solid var(--color-line)',
                            color: 'var(--color-faint)',
                          }
                        : undefined
                    }
                  >
                    {isAuto ? 'A' : ''}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">{t('set.font')}</div>
          <div className="text-[12px] text-faint">
            {isPro ? t('set.fontPro') : t('set.fontFree')}
          </div>
          {!isPro && (
            <Link
              to="/pricing"
              className="mt-1 inline-block text-[12px] font-semibold text-sage underline-offset-2 hover:text-cream hover:underline"
            >
              {t('set.fontUpgrade')}
            </Link>
          )}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:max-w-[min(100%,22rem)] sm:justify-end">
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

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">{t('set.size')}</div>
          <div className="text-[12px] text-faint">{t('set.sizeH')}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
