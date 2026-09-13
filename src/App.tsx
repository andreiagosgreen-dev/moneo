import { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import TimerCard from "./components/TimerCard";
import StatsCard from "./components/StatsCard";
import SettingsCard from "./components/SettingsCard";
import BrandMark from "./components/BrandMark";
import GrowthCard from "./components/GrowthCard";
import AccountButton from "./components/AccountButton";
import PrivacyPolicy from "./components/PrivacyPolicy";
import TermsOfService from "./components/TermsOfService";
import {
  MODE_META,
  durationFor,
  fmtClock,
  fmtMinutes,
  loadHistory,
  loadSettings,
  loadSnapshot,
  playChime,
  saveHistory,
  saveSettings,
  saveSnapshot,
  showNotification,
  requestNotificationPermission,
  type Mode,
  type Session,
  type Settings,
} from "./lib/store";
import {
  applyCompletion,
  applySkip,
  endsAtFor,
  remainingAt,
  shouldPersist,
} from "./lib/timerEngine";
import { assembleSession } from "./lib/sessions";
import { loadIntentionDraft, saveIntentionDraft } from "./lib/intentions";
import {
  activeAreas,
  armRoundFocus,
  createFocusArea,
  loadFocusAreas,
  loadSelectedArea,
  markAreaDeleted,
  renameFocusArea,
  saveFocusAreas,
  saveSelectedArea,
} from "./lib/focusAreas";
import { runLocalMigrations } from "./lib/storage/migrations";
import { useAuth } from "./lib/authProvider";
import { isTodayInTz } from "./lib/timezone";
import { loadSyncState, onSyncStateChange } from "./lib/sync/syncState";

/* Boot once: restore settings, history and the paused timer position. */
const BOOT = (() => {
  // Advance the local storage schema before any data load (idempotent).
  runLocalMigrations();
  const settings = loadSettings();
  const snap = loadSnapshot();
  const mode: Mode = snap?.mode ?? "focus";
  const total = snap?.mode === mode ? snap.total : durationFor(mode, settings);
  const remaining = snap?.mode === mode ? Math.min(snap.remaining, total) : total;
  const intentionDraft = loadIntentionDraft();
  const areas = loadFocusAreas();
  const selectedAreaId = loadSelectedArea(areas);
  // Round metadata is captured at arming time; boot arms the current round.
  const roundMeta =
    mode === "focus"
      ? armRoundFocus(intentionDraft, selectedAreaId, areas)
      : { intention: null, areaId: null };
  return {
    settings,
    history: loadHistory(),
    mode,
    total,
    remaining,
    cycle: snap?.cycle ?? 0,
    roundMin: mode === "focus" ? settings.focusMin : 0,
    intentionDraft,
    areas,
    selectedAreaId,
    roundIntention: roundMeta.intention,
    roundAreaId: roundMeta.areaId,
  };
})();

export default function App() {
  const location = useLocation();
  const isLegalPage = location.pathname === "/privacy" || location.pathname === "/terms";

  const auth = useAuth();
  const [syncState, setSyncState] = useState(loadSyncState);
  useEffect(() => onSyncStateChange(() => setSyncState(loadSyncState())), []);
  const [settings, setSettings] = useState<Settings>(BOOT.settings);
  const [history, setHistory] = useState<Session[]>(BOOT.history);
  const [mode, setMode] = useState<Mode>(BOOT.mode);
  const [total, setTotal] = useState(BOOT.total);
  const [remaining, setRemaining] = useState(BOOT.remaining);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(BOOT.cycle);
  const [flashKey, setFlashKey] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [intentionDraft, setIntentionDraft] = useState(BOOT.intentionDraft);
  const [areas, setAreas] = useState(BOOT.areas);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    BOOT.selectedAreaId,
  );

  const endsAtRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  const cycleRef = useRef(cycle);
  const totalRef = useRef(total);
  const remainingRef = useRef(remaining);
  // Focus minutes belonging to the round that is currently armed/running.
  const roundMinRef = useRef(BOOT.roundMin);
  // Intention + area are captured once, at arming time — a running round
  // keeps exactly these values no matter what the user edits afterwards.
  const roundIntentionRef = useRef<string | null>(BOOT.roundIntention);
  const roundAreaIdRef = useRef<string | null>(BOOT.roundAreaId);
  const intentionDraftRef = useRef(intentionDraft);
  const areasRef = useRef(areas);
  const selectedAreaIdRef = useRef(selectedAreaId);
  modeRef.current = mode;
  settingsRef.current = settings;
  cycleRef.current = cycle;
  totalRef.current = total;
  remainingRef.current = remaining;
  intentionDraftRef.current = intentionDraft;
  areasRef.current = areas;
  selectedAreaIdRef.current = selectedAreaId;

  const captureRoundMeta = () => {
    const meta = armRoundFocus(
      intentionDraftRef.current,
      selectedAreaIdRef.current,
      areasRef.current,
    );
    roundIntentionRef.current = meta.intention;
    roundAreaIdRef.current = meta.areaId;
  };

  /* ---------- engine ---------- */

  const start = () => {
    if (remainingRef.current <= 0) {
      remainingRef.current = totalRef.current;
      setRemaining(totalRef.current);
    }
    // Arming a fresh focus round: capture its immutable metadata.
    // Resumes (remaining < total) keep the round's original capture.
    if (
      modeRef.current === "focus" &&
      remainingRef.current === totalRef.current
    ) {
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
    if (next === "focus") {
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
    const res = applyCompletion(
      m,
      cycleRef.current,
      s,
      endsAtRef.current,
      roundMinRef.current,
    );
    playChime(s.sound, s.soundType, s.volume);
    
    // Show browser notification if enabled
    if (s.notifications) {
      const title = m === "focus" ? "Focus session complete" : "Break over";
      const body = m === "focus" 
        ? res.mode === "long" ? "Long break time" : "Short break time"
        : "Ready to focus";
      showNotification(title, body);
    }
    setFlashKey((k) => k + 1);
    // Assemble the entry with its stable id + round-captured metadata.
    const entry = assembleSession(res.session, {
      intention: roundIntentionRef.current,
      areaId: roundAreaIdRef.current,
    });
    if (entry) setHistory((h) => [...h, entry]);
    setCycle(res.cycle);
    setAnnounce(
      m === "focus"
        ? res.mode === "long"
          ? "Focus session complete. Long break."
          : "Focus session complete. Short break."
        : s.autoStart
          ? "Break over. Focus started."
          : "Break over. Ready to focus.",
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
    if (m === "focus") {
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
      ["focusMin", "focus"],
      ["shortMin", "short"],
      ["longMin", "long"],
    ];
    for (const [key, m] of durKeys) {
      const v = patch[key];
      if (
        typeof v === "number" &&
        m === modeRef.current &&
        !runningRef.current &&
        remainingRef.current === totalRef.current
      ) {
        const d = v * 60;
        setTotal(d);
        setRemaining(d);
        totalRef.current = d;
        remainingRef.current = d;
        if (key === "focusMin") roundMinRef.current = v;
      }
    }
    if (typeof patch.longEvery === "number") {
      setCycle((c) => Math.min(c, patch.longEvery! - 1));
    }
  };

  /* ---------- persistence ---------- */

  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => saveIntentionDraft(intentionDraft), [intentionDraft]);
  useEffect(() => { saveFocusAreas(areas); }, [areas]);
  useEffect(() => saveSelectedArea(selectedAreaId), [selectedAreaId]);
  
  // Request notification permission when notifications are enabled
  useEffect(() => {
    if (settings.notifications) {
      requestNotificationPermission();
    }
  }, [settings.notifications]);
  // Persist only meaningful state: every discrete change (mode/total/cycle),
  // every pause/idle settle, and at most once per 10s of live countdown.
  const sigRef = useRef("");
  const lastPersistRef = useRef(0);
  useEffect(() => {
    const sig = `${mode}|${total}|${cycle}`;
    const now = Date.now();
    if (
      shouldPersist(
        sigRef.current,
        sig,
        running,
        now,
        lastPersistRef.current,
        10_000,
      )
    ) {
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
      document.title = "Moneo — Focus Timer";
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
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        el?.isContentEditable
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleRef.current();
      } else if (e.code === "KeyR") {
        resetRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- focus areas (CRUD never touches history) ---------- */

  const handleCreateArea = (name: string): boolean => {
    const next = createFocusArea(activeAreas(areas), name);
    if (!next) return false;
    setAreas(next);
    setSelectedAreaId(next[next.length - 1].id);
    return true;
  };

  const handleRenameArea = (id: string, name: string): boolean => {
    const next = renameFocusArea(areas, id, name);
    if (!next) return false;
    setAreas(next);
    return true;
  };

  const handleDeleteArea = (id: string) => {
    // Soft-delete: the entry stays (marked) so sync can propagate the
    // deletion and historical sessions keep resolving meaning.
    setAreas(markAreaDeleted(areas, id));
    if (selectedAreaId === id) setSelectedAreaId(null);
  };

  const minutesToday = history
    .filter((s) => isTodayInTz(s.at, auth.timezone))
    .reduce((sum, s) => sum + s.min, 0);

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route
        path="*"
        element={
          <div data-mode={mode} className="relative min-h-screen overflow-hidden">
            {/* ambient layers */}
            <div className={`bg-glow bg-glow-focus ${mode === "focus" ? "is-on" : ""}`} aria-hidden />
            <div className={`bg-glow bg-glow-short ${mode === "short" ? "is-on" : ""}`} aria-hidden />
            <div className={`bg-glow bg-glow-long ${mode === "long" ? "is-on" : ""}`} aria-hidden />
            <div className="bg-grid" aria-hidden />
            <div className="bg-grain" aria-hidden />
            <p role="status" aria-live="polite" className="sr-only">
              {announce}
            </p>

            <div className="relative z-10 mx-auto max-w-6xl px-4 pb-6 pt-6 sm:px-6">
              {/* header */}
              <header className="reveal flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card2/80 shadow-lg"
                    style={{ boxShadow: "0 8px 24px -8px rgb(var(--accent-rgb) / 0.45)" }}
                  >
                    <BrandMark />
                  </div>
                  <div>
                    <h1 className="font-display text-[22px] font-extrabold leading-none tracking-tight text-cream">
                      Moneo
                    </h1>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
                      Focus companion
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-line bg-card/80 py-2 pl-3 pr-4">
                    <span
                      className={`relative inline-block h-2 w-2 rounded-full ${running ? "ping-dot" : ""}`}
                      style={{ background: "var(--accent)", color: "var(--accent)" }}
                    />
                    <span className="font-mono text-[12px] text-sage">
                      today&nbsp;
                      <span className="font-semibold text-cream">
                        {minutesToday > 0 ? fmtMinutes(minutesToday) : "0m"}
                      </span>
                    </span>
                  </div>
                  <AccountButton />
                </div>
              </header>

              {/* main */}
              <main className="mt-7 grid gap-6 lg:grid-cols-[7fr_5fr]">
                <div className="reveal" style={{ animationDelay: "90ms" }}>
                  <TimerCard
                    mode={mode}
                    running={running}
                    remaining={remaining}
                    total={total}
                    cycle={cycle}
                    settings={settings}
                    flashKey={flashKey}
                    onModeChange={switchMode}
                    onToggle={toggle}
                    onReset={reset}
                    onSkip={skip}
                    intentionDraft={intentionDraft}
                    onIntentionDraftChange={setIntentionDraft}
                    onIntentionEnter={() => {
                      if (!runningRef.current && modeRef.current === "focus") start();
                    }}
                    areas={activeAreas(areas)}
                    selectedAreaId={selectedAreaId}
                    onSelectArea={setSelectedAreaId}
                    onCreateArea={handleCreateArea}
                    onRenameArea={handleRenameArea}
                    onDeleteArea={handleDeleteArea}
                  />
                </div>

                <div className="flex flex-col gap-6">
                  <div className="reveal" style={{ animationDelay: "135ms" }}>
                    <GrowthCard history={history} />
                  </div>
                  <div className="reveal" style={{ animationDelay: "180ms" }}>
                    <StatsCard
                      history={history}
                      settings={settings}
                      areas={areas}
                      timezone={auth.timezone}
                      clearDisabled={syncState.initialized}
                      onClear={() => setHistory([])}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: "270ms" }}>
                    <SettingsCard settings={settings} onChange={updateSettings} />
                  </div>
                </div>
              </main>

              {/* footer */}
              <footer
                className="reveal mt-9 flex flex-col items-center justify-between gap-3 border-t border-line/70 pt-5 sm:flex-row"
                style={{ animationDelay: "360ms" }}
              >
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <p className="font-mono text-[11px] text-faint">
                    Moneo — build focus. See it grow.
                  </p>
                  <div className="flex items-center gap-4 font-mono text-[11px] text-faint">
                    <Link to="/privacy" className="hover:text-cream transition-colors">
                      Privacy
                    </Link>
                    <Link to="/terms" className="hover:text-cream transition-colors">
                      Terms
                    </Link>
                  </div>
                </div>
                <p className="hidden items-center gap-2 font-mono text-[11px] text-faint sm:flex">
                  <span className="kbd">Space</span> start / pause
                  <span className="kbd">R</span> reset
                </p>
              </footer>
            </div>
          </div>
        }
      />
    </Routes>
  );
}
