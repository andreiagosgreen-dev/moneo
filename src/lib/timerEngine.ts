import type { Mode, Session, Settings } from "./store";

/**
 * Pure timer-domain logic, extracted from App.tsx so it can be tested
 * deterministically. App.tsx remains the owner of refs/state and wiring;
 * every rule below is a pure function of its inputs.
 */

export interface CompletionResult {
  /** Mode to transition into. */
  mode: Mode;
  /** Updated cycle counter (completed focus rounds in the current cycle). */
  cycle: number;
  /** Session to credit — only ever produced by a natural focus completion. */
  session: Session | null;
}

/**
 * What happens when a round reaches zero naturally.
 *
 * @param mode     the round that just finished
 * @param cycle    completed focus rounds in the current cycle (pre-completion)
 * @param settings current settings (drives long-break scheduling)
 * @param at       the *scheduled* completion timestamp (epoch ms)
 * @param roundMin focus minutes belonging to the round that actually ran
 */
export function applyCompletion(
  mode: Mode,
  cycle: number,
  settings: Settings,
  at: number,
  roundMin: number,
): CompletionResult {
  if (mode === "focus") {
    const done = cycle + 1;
    const isLong = done >= settings.longEvery;
    return {
      mode: isLong ? "long" : "short",
      cycle: isLong ? 0 : done,
      session: { at, min: roundMin },
    };
  }
  return { mode: "focus", cycle, session: null };
}

/** Skip never credits a session — it only selects the next mode. */
export function applySkip(mode: Mode): Mode {
  return mode === "focus" ? "short" : "focus";
}

/** Seconds left on a schedule, never negative. */
export function remainingAt(endsAt: number, now: number): number {
  return Math.max(0, Math.round((endsAt - now) / 1000));
}

/** Epoch ms at which a round of `remaining` seconds will end. */
export function endsAtFor(remaining: number, now: number): number {
  return now + remaining * 1000;
}

/**
 * Snapshot write gate — prevents persisting on every visual countdown tick.
 * Writes happen on any discrete state change, always while paused/idle,
 * and at most once per `throttleMs` while the countdown runs.
 */
export function shouldPersist(
  prevSig: string,
  nextSig: string,
  running: boolean,
  now: number,
  lastPersistAt: number,
  throttleMs: number,
): boolean {
  if (prevSig !== nextSig) return true; // mode / total / cycle changed
  if (!running) return true; // pause & idle states are always persisted exactly
  return now - lastPersistAt >= throttleMs;
}
