import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  MODE_META,
  durationFor,
  fmtClock,
  playChime,
  showNotification,
  saveSnapshot,
  type Mode,
  type Session,
  type Settings,
} from '../lib/store';
import {
  applyCompletion,
  applySkip,
  endsAtFor,
  remainingAt,
  shouldPersist,
} from '../lib/timerEngine';
import { assembleSession } from '../lib/sessions';
import { armRoundFocus, type FocusArea } from '../lib/focusAreas';

/**
 * Countdown engine + chrome (Roadmap Faza 1.2).
 *
 * Owns every piece of timer state (mode, totals, countdown, cycle, flash,
 * announcements) plus the ref mirrors that keep the 200ms interval exact,
 * round arming, snapshot persistence, document title and keyboard shortcuts.
 * Moved verbatim from App — behavior is unchanged; only the address moved.
 */

export interface RoundContext {
  intentionDraft: string;
  selectedAreaId: string | null;
  areas: FocusArea[];
  selectedProjectId: string | null;
  selectedTaskId: string | null;
}

export interface TimerInitial {
  mode: Mode;
  total: number;
  remaining: number;
  cycle: number;
  roundMin: number;
  roundIntention: string | null;
  roundAreaId: string | null;
  roundProjectId: string | null;
  roundTaskId: string | null;
}

export interface UseTimerOptions {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  /** Fresh selection snapshot, read at arming time (never stale). */
  getContext: () => RoundContext;
  /** Receives a completed focus session for the caller to record. */
  onSession: (entry: Session) => void;
  initial: TimerInitial;
}

export function useTimer({
  settings,
  setSettings,
  getContext,
  onSession,
  initial,
}: UseTimerOptions) {
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [total, setTotal] = useState(initial.total);
  const [remaining, setRemaining] = useState(initial.remaining);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(initial.cycle);
  const [flashKey, setFlashKey] = useState(0);
  const [announce, setAnnounce] = useState('');

  const endsAtRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  const cycleRef = useRef(cycle);
  const totalRef = useRef(total);
  const remainingRef = useRef(remaining);
  // Focus minutes belonging to the round that is currently armed/running.
  const roundMinRef = useRef(initial.roundMin);
  // Intention + area + project are captured once, at arming time — a running round
  // keeps exactly these values no matter what the user edits afterwards.
  const roundIntentionRef = useRef<string | null>(initial.roundIntention);
  const roundAreaIdRef = useRef<string | null>(initial.roundAreaId);
  const roundProjectIdRef = useRef<string | null>(initial.roundProjectId);
  const roundTaskIdRef = useRef<string | null>(initial.roundTaskId);
  const contextRef = useRef(getContext);
  modeRef.current = mode;
  settingsRef.current = settings;
  cycleRef.current = cycle;
  totalRef.current = total;
  remainingRef.current = remaining;
  contextRef.current = getContext;

  const captureRoundMeta = () => {
    const ctx = contextRef.current();
    const meta = armRoundFocus(ctx.intentionDraft, ctx.selectedAreaId, ctx.areas);
    roundIntentionRef.current = meta.intention;
    roundAreaIdRef.current = meta.areaId;
    roundProjectIdRef.current = ctx.selectedProjectId;
    roundTaskIdRef.current = roundProjectIdRef.current !== null ? ctx.selectedTaskId : null;
  };

  /* ---------- engine ---------- */

  const start = () => {
    if (remainingRef.current <= 0) {
      remainingRef.current = totalRef.current;
      setRemaining(totalRef.current);
    }
    // Arming a fresh focus round: capture its immutable metadata.
    // Resumes (remaining < total) keep the round's original capture.
    if (modeRef.current === 'focus' && remainingRef.current === totalRef.current) {
      captureRoundMeta();
    }
    endsAtRef.current = endsAtFor(remainingRef.current, Date.now());
    runningRef.current = true;
    setRunning(true);
  };

  const pause = () => {
    runningRef.current = false;
    setRunning(false);
    const rem = remainingAt(endsAtRef.current, Date.now());
    remainingRef.current = rem;
    setRemaining(rem);
  };

  const reset = () => {
    runningRef.current = false;
    setRunning(false);
    remainingRef.current = totalRef.current;
    setRemaining(totalRef.current);
  };

  const gotoMode = (next: Mode, auto: boolean) => {
    const d = durationFor(next, settingsRef.current);
    setMode(next);
    setTotal(d);
    setRemaining(d);
    remainingRef.current = d;
    totalRef.current = d;
    if (next === 'focus') {
      roundMinRef.current = settingsRef.current.focusMin;
      captureRoundMeta();
    }
    if (auto) {
      endsAtRef.current = endsAtFor(d, Date.now());
      runningRef.current = true;
      setRunning(true);
    }
  };

  const completeRef = useRef<() => void>(() => {});
  completeRef.current = () => {
    const m = modeRef.current;
    const s = settingsRef.current;
    // Credit the round that actually ran, stamped with its *scheduled* end —
    // not the (possibly much later) moment a suspended browser noticed.
    const res = applyCompletion(m, cycleRef.current, s, endsAtRef.current, roundMinRef.current);
    playChime(s.sound, s.soundType, s.volume);

    // Show browser notification if enabled
    if (s.notifications) {
      const title = m === 'focus' ? 'Focus session complete' : 'Break over';
      const body =
        m === 'focus'
          ? res.mode === 'long'
            ? 'Long break time'
            : 'Short break time'
          : 'Ready to focus';
      showNotification(title, body);
    }
    setFlashKey((k) => k + 1);
    // Assemble the entry with its stable id + round-captured metadata.
    const entry = assembleSession(res.session, {
      intention: roundIntentionRef.current,
      areaId: roundAreaIdRef.current,
      projectId: roundProjectIdRef.current,
      taskId: roundTaskIdRef.current,
    });
    if (entry) onSession(entry);
    setCycle(res.cycle);
    setAnnounce(
      m === 'focus'
        ? res.mode === 'long'
          ? 'Focus session complete. Long break.'
          : 'Focus session complete. Short break.'
        : s.autoStart
          ? 'Break over. Focus started.'
          : 'Break over. Ready to focus.',
    );
    gotoMode(res.mode, s.autoStart);
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const rem = remainingAt(endsAtRef.current, Date.now());
      remainingRef.current = rem;
      setRemaining(rem);
      if (rem <= 0 && runningRef.current) {
        runningRef.current = false;
        setRunning(false);
        completeRef.current();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  /* ---------- actions ---------- */

  const toggle = () => (runningRef.current ? pause() : start());

  const switchMode = (m: Mode) => {
    if (m === modeRef.current) return;
    runningRef.current = false;
    setRunning(false);
    const d = durationFor(m, settingsRef.current);
    if (m === 'focus') {
      roundMinRef.current = settingsRef.current.focusMin;
      captureRoundMeta();
    }
    setMode(m);
    setTotal(d);
    setRemaining(d);
  };

  const skip = () => {
    runningRef.current = false;
    setRunning(false);
    gotoMode(applySkip(modeRef.current), false);
  };

  const updateSettings = (patch: Partial<Settings>) => {
    // Stamp every edit so settings sync can use last-write-wins.
    const next = { ...settings, ...patch, updatedAt: Date.now() };
    setSettings(next);
    const durKeys: Array<[keyof Settings, Mode]> = [
      ['focusMin', 'focus'],
      ['shortMin', 'short'],
      ['longMin', 'long'],
    ];
    for (const [key, m] of durKeys) {
      const v = patch[key];
      if (
        typeof v === 'number' &&
        m === modeRef.current &&
        !runningRef.current &&
        remainingRef.current === totalRef.current
      ) {
        const d = v * 60;
        setTotal(d);
        setRemaining(d);
        totalRef.current = d;
        remainingRef.current = d;
        if (key === 'focusMin') roundMinRef.current = v;
      }
    }
    if (typeof patch.longEvery === 'number') {
      setCycle((c) => Math.min(c, patch.longEvery! - 1));
    }
  };

  // Persist only meaningful state: every discrete change (mode/total/cycle),
  // every pause/idle settle, and at most once per 10s of live countdown.
  const sigRef = useRef('');
  const lastPersistRef = useRef(0);
  useEffect(() => {
    const sig = `${mode}|${total}|${cycle}`;
    const now = Date.now();
    if (shouldPersist(sigRef.current, sig, running, now, lastPersistRef.current, 10_000)) {
      sigRef.current = sig;
      lastPersistRef.current = now;
      saveSnapshot({ mode, total, remaining, cycle });
    }
  }, [mode, total, remaining, cycle, running]);

  /* ---------- living chrome ---------- */

  useEffect(() => {
    const { label } = MODE_META[mode];
    if (running || remaining < total) {
      const { mm, ss } = fmtClock(remaining);
      document.title = `${mm}:${ss} · ${label} — Moneo`;
    } else {
      document.title = 'Moneo — Focus Timer';
    }
  }, [running, remaining, total, mode]);

  const toggleRef = useRef(toggle);
  const resetRef = useRef(reset);
  toggleRef.current = toggle;
  resetRef.current = reset;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        el?.isContentEditable
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRef.current();
      } else if (e.code === 'KeyR') {
        resetRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    mode,
    running,
    remaining,
    total,
    cycle,
    flashKey,
    announce,
    start,
    toggle,
    reset,
    skip,
    switchMode,
    updateSettings,
  };
}
