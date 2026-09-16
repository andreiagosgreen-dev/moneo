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
          aria-label={`Decrease ${label}`}
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
          aria-label={`Increase ${label}`}
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
    <section className="card px-6 py-6 sm:px-7" aria-label="Timer settings">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">Tune it</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          Saved locally
        </span>
      </header>

      <div className="mt-3 divide-y divide-line/70">
        <Stepper
          label="Focus length"
          hint="One deep-work round"
          value={settings.focusMin}
          unit="min"
          field="focusMin"
          accent
          onStep={step}
        />
        <Stepper
          label="Short break"
          hint="Between focus rounds"
          value={settings.shortMin}
          unit="min"
          field="shortMin"
          onStep={step}
        />
        <Stepper
          label="Long break"
          hint="After a full cycle"
          value={settings.longMin}
          unit="min"
          field="longMin"
          onStep={step}
        />
        <Stepper
          label="Cycle length"
          hint="Focus rounds per long break"
          value={settings.longEvery}
          unit="rnd"
          field="longEvery"
          onStep={step}
        />
        <Stepper
          label="Daily goal"
          hint="Focus sessions per day"
          value={settings.dailyGoal}
          unit="ses"
          field="dailyGoal"
          onStep={step}
        />
      </div>

      <div className="mt-2 divide-y divide-line/70 border-t border-line">
        <Toggle
          label="Auto-start next"
          hint="Roll straight into the next round"
          on={settings.autoStart}
          onClick={() => onChange({ autoStart: !settings.autoStart })}
        />
        <Toggle
          label="Completion chime"
          hint="Play sound when a round ends"
          on={settings.sound}
          onClick={() => onChange({ sound: !settings.sound })}
        />
        {settings.sound && (
          <>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">Sound type</div>
                <div className="text-[12px] text-faint">Choose your notification sound</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={settings.soundType}
                  onChange={(e) => onChange({ soundType: e.target.value as SoundType })}
                  className="min-w-32 rounded-lg bg-ink/60 px-3 py-2 text-sm font-semibold text-cream ring-1 ring-inset ring-line"
                >
                  {BUILT_IN_SOUNDS.map((s) => (
                    <option key={s} value={s}>
                      {SOUND_LABELS[s]}
                    </option>
                  ))}
                  <option value="custom">{CUSTOM_SOUND_LABEL}</option>
                </select>
                <button
                  onClick={() => {
                    if (settings.soundType === 'custom' && !hasCustom) return;
                    playSound(settings.soundType, settings.volume / 100);
                  }}
                  className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/60 text-cream/70 ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                  aria-label="Preview sound"
                  title="Preview sound"
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
                  <div className="text-[14px] font-semibold text-cream/90">Custom upload</div>
                  <div className="text-[12px] text-faint">
                    {hasCustom ? 'Your sound is stored on this device.' : 'MP3, WAV, OGG or WebM'}
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
                        Remove
                      </button>
                      <button
                        onClick={() => playSound('custom', settings.volume / 100)}
                        className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                      >
                        Test
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="press flex h-9 items-center justify-center rounded-lg bg-ink/60 px-3 text-[12px] font-semibold text-cream/70 ring-1 ring-inset ring-line hover:text-cream"
                    >
                      Upload
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">Volume</div>
                <div className="text-[12px] text-faint">Adjust sound volume</div>
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
              label="Browser notifications"
              hint="Show notification when timer ends"
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
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="text-[14px] font-semibold text-cream/90">{text}</div>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        Appearance
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
  const set = (patch: Partial<UITheme>) => onThemeChange({ ...theme, ...patch });

  return (
    <div className="mt-2 divide-y divide-line/70 border-t border-line">
      <SectionLabel text="Theme" />

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">Mode</div>
          <div className="text-[12px] text-faint">
            {isPro ? 'Pick a light or dark look' : 'Light mode is part of Moneo Pro'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {THEME_OPTIONS.map((t) => (
            <Chip
              key={t}
              selected={theme.theme === t}
              disabled={t === 'light' && !isPro}
              onClick={() => set({ theme: t as ThemeName })}
            >
              {t}
              {t === 'light' && !isPro && ' · Pro'}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">Accent</div>
          <div className="text-[12px] text-faint">
            {isPro
              ? 'Color of buttons, glow and highlights'
              : 'Custom accents are part of Moneo Pro'}
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
                  aria-label={`Accent ${k}`}
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
          <div className="text-[14px] font-semibold text-cream/90">Display font</div>
          <div className="text-[12px] text-faint">
            {isPro ? 'Headline style' : 'Serif headlines are part of Moneo Pro'}
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
              {f}
              {f === 'serif' && !isPro && ' · Pro'}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-cream/90">Text size</div>
          <div className="text-[12px] text-faint">A comfortable reading fit</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {FONT_SCALE_OPTIONS.map((s) => (
            <Chip
              key={s}
              selected={theme.fontScale === s}
              onClick={() => set({ fontScale: s as FontScale })}
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
