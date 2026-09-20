import type { Settings, SoundType } from '../lib/store';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  playSound,
  BUILT_IN_SOUNDS,
  SOUND_LABELS,
  CUSTOM_SOUND_LABEL,
  saveCustomSound,
  loadCustomSound,
  deleteCustomSound,
} from '../lib/soundEngine';
import {
  ACCENT_PRESETS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  THEME_OPTIONS,
  type AccentName,
  type FontChoice,
  type FontScale,
  type ThemeName,
  type UITheme,
} from '../lib/theme';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const THEME_LABELS: Record<ThemeName, TKey> = {
  dark: 'settings.theme.dark',
  light: 'settings.theme.light',
};

const FONT_CHOICE_LABELS: Record<FontChoice, TKey> = {
  sans: 'settings.font.sans',
  serif: 'settings.font.serif',
};

const FONT_SCALE_LABELS: Record<FontScale, TKey> = {
  normal: 'settings.fontScale.normal',
  comfort: 'settings.fontScale.comfort',
  compact: 'settings.fontScale.compact',
};

const ACCENT_NAME_LABELS: Record<AccentName, TKey> = {
  auto: 'settings.accentName.auto',
  tomato: 'settings.accentName.tomato',
  mint: 'settings.accentName.mint',
  sky: 'settings.accentName.sky',
  violet: 'settings.accentName.violet',
  amber: 'settings.accentName.amber',
  rose: 'settings.accentName.rose',
};

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  theme: UITheme;
  onThemeChange: (t: UITheme) => void;
  isPro?: boolean;
}

type NumKey = 'focusMin' | 'shortMin' | 'longMin' | 'longEvery' | 'dailyGoal';

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
          aria-label={t('settings.stepperAria.decrease', { label })}
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
          aria-label={t('settings.stepperAria.increase', { label })}
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
    <section className="card px-6 py-6 sm:px-7" aria-label={t('settings.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('settings.title')}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          {t('settings.savedLocally')}
        </span>
      </header>

      <div className="mt-3 divide-y divide-line/70">
        <Stepper
          label={t('settings.stepper.focusLength.label')}
          hint={t('settings.stepper.focusLength.hint')}
          value={settings.focusMin}
          unit={t('settings.unit.min')}
          field="focusMin"
          accent
          onStep={step}
        />
        <Stepper
          label={t('settings.stepper.shortBreak.label')}
          hint={t('settings.stepper.shortBreak.hint')}
          value={settings.shortMin}
          unit={t('settings.unit.min')}
          field="shortMin"
          onStep={step}
        />
        <Stepper
          label={t('settings.stepper.longBreak.label')}
          hint={t('settings.stepper.longBreak.hint')}
          value={settings.longMin}
          unit={t('settings.unit.min')}
          field="longMin"
          onStep={step}
        />
        <Stepper
          label={t('settings.stepper.cycleLength.label')}
          hint={t('settings.stepper.cycleLength.hint')}
          value={settings.longEvery}
          unit={t('settings.unit.rnd')}
          field="longEvery"
          onStep={step}
        />
        <Stepper
          label={t('settings.stepper.dailyGoal.label')}
          hint={t('settings.stepper.dailyGoal.hint')}
          value={settings.dailyGoal}
          unit={t('settings.unit.ses')}
          field="dailyGoal"
          onStep={step}
        />
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-cream/90">
              {t('settings.weeklyCapacity.label')}
            </div>
            <div className="text-[12px] text-faint">{t('settings.weeklyCapacity.hint')}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() =>
                onChange({ weeklyCapacityMin: Math.max(60, settings.weeklyCapacityMin - 60) })
              }
              className="press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25 disabled:pointer-events-none"
              disabled={settings.weeklyCapacityMin <= 60}
              aria-label={t('settings.weeklyCapacity.decreaseAria')}
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
              aria-label={t('settings.weeklyCapacity.increaseAria')}
            >
              <PlusIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 divide-y divide-line/70 border-t border-line">
        <Toggle
          label={t('settings.toggle.autoStart.label')}
          hint={t('settings.toggle.autoStart.hint')}
          on={settings.autoStart}
          onClick={() => onChange({ autoStart: !settings.autoStart })}
        />
        <Toggle
          label={t('settings.toggle.chime.label')}
          hint={t('settings.toggle.chime.hint')}
          on={settings.sound}
          onClick={() => onChange({ sound: !settings.sound })}
        />
        {settings.sound && (
          <>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">
                  {t('settings.soundType.label')}
                </div>
                <div className="text-[12px] text-faint">{t('settings.soundType.hint')}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={settings.soundType}
                  onChange={(e) => onChange({ soundType: e.target.value as SoundType })}
                  className="min-w-32 rounded-lg bg-ink/60 px-3 py-2 text-sm font-semibold text-cream ring-1 ring-inset ring-line"
                >
                  {BUILT_IN_SOUNDS.map((s) => (
                    <option key={s} value={s}>
                      {t(SOUND_LABELS[s])}
                    </option>
                  ))}
                  <option value="custom">{t(CUSTOM_SOUND_LABEL)}</option>
                </select>
                <button
                  onClick={() => {
                    if (settings.soundType === 'custom' && !hasCustom) return;
                    playSound(settings.soundType, settings.volume / 100);
                  }}
                  className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/60 text-cream/70 ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                  aria-label={t('settings.previewSound')}
                  title={t('settings.previewSound')}
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
                  <div className="text-[14px] font-semibold text-cream/90">
                    {t('settings.customUpload.label')}
                  </div>
                  <div className="text-[12px] text-faint">
                    {hasCustom
                      ? t('settings.customUpload.stored')
                      : t('settings.customUpload.formats')}
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
                        {t('settings.customUpload.remove')}
                      </button>
                      <button
                        onClick={() => playSound('custom', settings.volume / 100)}
                        className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                      >
                        {t('settings.customUpload.test')}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                    >
                      {t('settings.customUpload.upload')}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">
                  {t('settings.volume.label')}
                </div>
                <div className="text-[12px] text-faint">{t('settings.volume.hint')}</div>
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
              label={t('settings.toggle.browserNotif.label')}
              hint={t('settings.toggle.browserNotif.hint')}
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
        {t('settings.appearance.badge')}
      </span>
    </div>
  );
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`press rounded-lg px-3 py-1.5 font-mono text-[12px] font-semibold capitalize ring-1 transition-colors disabled:cursor-not-allowed ${
        selected
          ? 'bg-ink/70 text-cream ring-accent'
          : disabled
            ? 'text-faint ring-line disabled:opacity-50'
            : 'text-sage ring-line hover:text-cream hover:ring-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

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
  const set = (patch: Partial<UITheme>) => onThemeChange({ ...theme, ...patch });

  return (
    <div className="mt-2 divide-y divide-line/70 border-t border-line">
      <SectionLabel text={t('settings.appearance.theme')} />

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">
            {t('settings.appearance.mode.label')}
          </div>
          <div className="text-[12px] text-faint">
            {isPro ? t('settings.appearance.mode.hintPro') : t('settings.appearance.mode.hintFree')}
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
              {t(THEME_LABELS[opt])}
              {opt === 'light' && !isPro && t('settings.appearance.proSuffix')}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">
            {t('settings.appearance.accent.label')}
          </div>
          <div className="text-[12px] text-faint">
            {isPro
              ? t('settings.appearance.accent.hintPro')
              : t('settings.appearance.accent.hintFree')}
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
                  title={t(ACCENT_NAME_LABELS[k])}
                  aria-label={t('settings.appearance.accentAria', {
                    name: t(ACCENT_NAME_LABELS[k]),
                  })}
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

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">
            {t('settings.appearance.font.label')}
          </div>
          <div className="text-[12px] text-faint">
            {isPro ? t('settings.appearance.font.hintPro') : t('settings.appearance.font.hintFree')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {FONT_OPTIONS.map((f) => (
            <Chip
              key={f}
              selected={theme.font === f}
              disabled={f === 'serif' && !isPro}
              onClick={() => set({ font: f as FontChoice })}
            >
              {t(FONT_CHOICE_LABELS[f])}
              {f === 'serif' && !isPro && t('settings.appearance.proSuffix')}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">
            {t('settings.appearance.textSize.label')}
          </div>
          <div className="text-[12px] text-faint">{t('settings.appearance.textSize.hint')}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {FONT_SCALE_OPTIONS.map((s) => (
            <Chip
              key={s}
              selected={theme.fontScale === s}
              onClick={() => set({ fontScale: s as FontScale })}
            >
              {t(FONT_SCALE_LABELS[s])}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
