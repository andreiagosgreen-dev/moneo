/* Storage boundary: keys + safe I/O live in src/lib/storage (Gate 7).
   Key values are unchanged — legacy payloads stay readable. */
import { STORAGE_KEYS } from "./storage/storageKeys";
import { safeRead as read, safeWrite as write } from "./storage/storageAdapter";

export type Mode = "focus" | "short" | "long";

export type SoundType = "bell" | "gong" | "piano" | "birds" | "gentle";

export interface Settings {
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  dailyGoal: number;
  autoStart: boolean;
  sound: boolean;
  soundType: SoundType;
  volume: number; // 0-100
  notifications: boolean;
  /** Last-edit stamp — powers settings sync last-write-wins (Gate 9, additive). */
  updatedAt?: number;
}

export interface Session {
  id?: string; // stable id (Gate 8, additive) — legacy entries remain valid without one
  at: number; // epoch ms when the focus session completed
  min: number; // focused minutes credited
  intention?: string; // what the user intended to work on (Gate 5, additive)
  areaId?: string; // which Focus Area this round belonged to (Gate 6, additive)
}

export interface Snapshot {
  mode: Mode;
  total: number; // seconds
  remaining: number; // seconds
  cycle: number; // completed focus sessions in the current pomodoro cycle
}

export const DEFAULT_SETTINGS: Settings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  dailyGoal: 8,
  autoStart: false,
  sound: true,
  soundType: "bell",
  volume: 50,
  notifications: true,
};

export const MODE_META: Record<
  Mode,
  { label: string; short: string; tagline: string }
> = {
  focus: {
    label: "Focus",
    short: "Focus",
    tagline: "One thing. Deeply.",
  },
  short: {
    label: "Short break",
    short: "Short",
    tagline: "Stretch, sip, breathe.",
  },
  long: {
    label: "Long break",
    short: "Long",
    tagline: "Step away from the desk.",
  },
};

const KEYS = {
  settings: STORAGE_KEYS.settings,
  history: STORAGE_KEYS.history,
  snapshot: STORAGE_KEYS.snapshot,
};

export function loadSettings(): Settings {
  const stored = read<Partial<Settings>>(KEYS.settings);
  if (!stored) return { ...DEFAULT_SETTINGS };
  return {
    focusMin: clampNum(stored.focusMin, 1, 120, DEFAULT_SETTINGS.focusMin),
    shortMin: clampNum(stored.shortMin, 1, 60, DEFAULT_SETTINGS.shortMin),
    longMin: clampNum(stored.longMin, 1, 90, DEFAULT_SETTINGS.longMin),
    longEvery: clampNum(stored.longEvery, 2, 8, DEFAULT_SETTINGS.longEvery),
    dailyGoal: clampNum(stored.dailyGoal, 1, 20, DEFAULT_SETTINGS.dailyGoal),
    autoStart:
      typeof stored.autoStart === "boolean"
        ? stored.autoStart
        : DEFAULT_SETTINGS.autoStart,
    sound:
      typeof stored.sound === "boolean" ? stored.sound : DEFAULT_SETTINGS.sound,
    soundType: stored.soundType || DEFAULT_SETTINGS.soundType,
    volume: typeof stored.volume === "number" ? stored.volume : DEFAULT_SETTINGS.volume,
    notifications:
      typeof stored.notifications === "boolean"
        ? stored.notifications
        : DEFAULT_SETTINGS.notifications,
    ...(typeof stored.updatedAt === "number" && Number.isFinite(stored.updatedAt)
      ? { updatedAt: stored.updatedAt }
      : {}),
  };
}

export function saveSettings(s: Settings): boolean {
  return write(KEYS.settings, s);
}

export function loadHistory(): Session[] {
  const stored = read<Session[]>(KEYS.history);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((s) => s && typeof s.at === "number" && typeof s.min === "number")
    .map((s) => {
      // Optional fields are validated independently — an invalid intention,
      // areaId or id drops that *field* only, never the session itself.
      const intention =
        typeof s.intention === "string"
          ? s.intention.trim().slice(0, 80) || undefined // matches INTENTION_MAX
          : undefined;
      const areaId =
        typeof s.areaId === "string" && s.areaId.length > 0
          ? s.areaId
          : undefined;
      const id =
        typeof s.id === "string" && s.id.length > 0 ? s.id : undefined;
      return {
        ...(id ? { id } : {}),
        at: s.at,
        min: s.min,
        ...(intention ? { intention } : {}),
        ...(areaId ? { areaId } : {}),
      };
    });
}

export function saveHistory(h: Session[]): boolean {
  return write(KEYS.history, h);
}

export function loadSnapshot(): Snapshot | null {
  const snap = read<Snapshot>(KEYS.snapshot);
  if (
    !snap ||
    !["focus", "short", "long"].includes(snap.mode) ||
    typeof snap.total !== "number" ||
    typeof snap.remaining !== "number"
  )
    return null;
  return {
    mode: snap.mode,
    total: Math.max(60, snap.total),
    remaining: Math.min(Math.max(1, snap.remaining), Math.max(60, snap.total)),
    cycle: clampNum(snap.cycle, 0, 8, 0),
  };
}

export function saveSnapshot(s: Snapshot) {
  write(KEYS.snapshot, s);
}

function clampNum(v: unknown, min: number, max: number, fallback: number) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function durationFor(mode: Mode, s: Settings): number {
  return (
    (mode === "focus" ? s.focusMin : mode === "short" ? s.shortMin : s.longMin) *
    60
  );
}

/* ---------- date helpers (local time) ---------- */

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function isToday(ts: number): boolean {
  return dayKey(new Date(ts)) === dayKey(new Date());
}

export function lastNDays(n: number): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(d);
  }
  return out;
}

export function minutesOnDay(history: Session[], day: Date): number {
  const key = dayKey(day);
  return history
    .filter((s) => dayKey(new Date(s.at)) === key)
    .reduce((sum, s) => sum + s.min, 0);
}

export function currentStreak(history: Session[]): number {
  const days = new Set(history.map((s) => dayKey(new Date(s.at))));
  let streak = 0;
  const cursor = new Date();
  // If nothing logged yet today, the streak can still survive on yesterday.
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------- formatting ---------- */

export function fmtClock(totalSeconds: number): { mm: string; ss: string } {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return {
    mm: String(mm).padStart(2, "0"),
    ss: String(ss).padStart(2, "0"),
  };
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function fmtTimeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- completion chime (WebAudio, no assets) ---------- */

let audioCtx: AudioContext | null = null;

export function playChime(enabled: boolean, soundType: SoundType = "bell", volume: number = 50) {
  if (!enabled) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    
    const t0 = audioCtx.currentTime;
    const vol = volume / 100;
    
    // Sound patterns for different types
    const sounds: Record<SoundType, number[]> = {
      bell: [659.25, 987.77], // Two-note bell
      gong: [196, 293.66, 392], // Three-note gong
      piano: [523.25, 659.25, 783.99, 1046.50], // Piano chord
      birds: [880, 1100, 1320, 1760], // Bird chirp pattern
      gentle: [440, 554.37, 659.25], // Gentle three-note
    };
    
    const frequencies = sounds[soundType] || sounds.bell;
    
    frequencies.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      
      // Different waveforms for different sounds
      const waveforms: Record<SoundType, OscillatorType> = {
        bell: "sine",
        gong: "triangle",
        piano: "sine",
        birds: "sine",
        gentle: "sine",
      };
      
      osc.type = waveforms[soundType] || "sine";
      osc.frequency.value = freq;
      
      const start = t0 + i * 0.16;
      const duration = soundType === "gong" ? 1.0 : 0.6;
      
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18 * vol, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + duration + 0.1);
    });
  } catch {
    /* audio unavailable — stay silent */
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return Promise.resolve("denied");
  }
  
  if (Notification.permission === "granted") {
    return Promise.resolve("granted");
  }
  
  if (Notification.permission !== "denied") {
    return Notification.requestPermission();
  }
  
  return Promise.resolve("denied");
}

export function showNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  
  new Notification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "moneo-timer",
  });
}
