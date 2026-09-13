import type { Settings, SoundType } from "../lib/store";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

type NumKey = "focusMin" | "shortMin" | "longMin" | "longEvery" | "dailyGoal";

const LIMITS: Record<NumKey, { min: number; max: number }> = {
  focusMin: { min: 1, max: 120 },
  shortMin: { min: 1, max: 60 },
  longMin: { min: 1, max: 90 },
  longEvery: { min: 2, max: 8 },
  dailyGoal: { min: 1, max: 20 },
};

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
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
    "press btn-ghost flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-25 disabled:pointer-events-none";
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className={`text-[14px] font-semibold ${accent ? "" : "text-cream/90"}`} style={accent ? { color: "var(--accent)" } : undefined}>
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
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300"
        style={{
          background: on ? "var(--accent)" : "rgb(238 241 232 / 0.12)",
          boxShadow: on ? "0 0 14px rgb(var(--accent-rgb) / 0.5)" : "none",
        }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-all duration-300"
          style={{ left: on ? "calc(100% - 1.375rem)" : "0.125rem", background: on ? "var(--on-accent)" : "#eef1e8" }}
        />
      </span>
    </button>
  );
}

export default function SettingsCard({ settings, onChange }: Props) {
  const step = (field: NumKey, delta: number) => {
    const { min, max } = LIMITS[field];
    const next = Math.min(max, Math.max(min, settings[field] + delta));
    if (next !== settings[field]) onChange({ [field]: next } as Partial<Settings>);
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Timer settings">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          Tune it
        </h2>
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
              <select
                value={settings.soundType}
                onChange={(e) => onChange({ soundType: e.target.value as SoundType })}
                className="min-w-32 rounded-lg bg-ink/60 px-3 py-2 text-sm font-semibold text-cream ring-1 ring-inset ring-line"
              >
                <option value="bell">Bell</option>
                <option value="gong">Gong</option>
                <option value="piano">Piano</option>
                <option value="birds">Birds</option>
                <option value="gentle">Gentle</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-cream/90">Volume</div>
                <div className="text-[12px] text-faint">Adjust sound volume</div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={(e) => onChange({ volume: parseInt(e.target.value) })}
                className="w-32 accent-current"
              />
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
    </section>
  );
}
