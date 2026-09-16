import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TimerCard from './components/TimerCard';
import StatsCard from './components/StatsCard';
import SettingsCard from './components/SettingsCard';
import ReportsCard from './components/ReportsCard';
import BrandMark from './components/BrandMark';
import GrowthCard from './components/GrowthCard';
import AccountButton from './components/AccountButton';
import ProjectsCard from './components/ProjectsCard';
import InsightsCard from './components/InsightsCard';
import IvyLeeCard from './components/IvyLeeCard';
import CalendarCard from './components/CalendarCard';
import MatrixCard from './components/MatrixCard';
import FrogCard from './components/FrogCard';
import AssistantCard from './components/AssistantCard';
import GoalsCard from './components/GoalsCard';
import LifeCard from './components/LifeCard';
import AgileCard from './components/AgileCard';
import OkrCard from './components/OkrCard';
import SkillsCard from './components/SkillsCard';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import {
  loadProjects,
  loadSelectedProject,
  saveSelectedProject,
  saveProjects,
  deadlinesDue,
  loadDeadlineReminders,
  saveDeadlineReminders,
  markDeadlineReminded,
  localDayKey,
  type Project,
} from './lib/projects';
import { loadTasks, saveTasks, type Task } from './lib/tasks';
import { loadPlans, savePlans, carryForNewDay } from './lib/ivyLee';
import { loadBlocks, saveBlocks, type TimeBlock } from './lib/timeBlocks';
import { loadSkills, saveSkills, type Skill } from './lib/skills';
import { loadFrogLog, saveFrogLog, type FrogLog } from './lib/frog';
import { loadGoals, saveGoals, type Goal } from './lib/goals';
import { loadChatHistory, saveChatHistory, type ChatMessage } from './lib/assistant';
import {
  loadHabits,
  saveHabits,
  loadHabitLog,
  saveHabitLog,
  type Habit,
  type HabitLog,
} from './lib/habits';
import { loadLifeAreas, saveLifeAreas, type LifeArea } from './lib/lifeAreas';
import { loadJournal, saveJournal, type Journal } from './lib/journal';
import { loadEnergyLog, saveEnergyLog, type EnergyEntry } from './lib/energy';
import { loadSprints, saveSprints, type Sprint } from './lib/sprints';
import { loadObjectives, saveObjectives, type Objective } from './lib/okrs';
import { loadPhases, savePhases, type WaterfallPhase } from './lib/waterfall';
import {
  applyTheme,
  loadTheme,
  loadOnboardingSeen,
  markOnboardingSeen,
  saveTheme,
  type UITheme,
} from './lib/theme';
import OnboardingModal from './components/OnboardingModal';
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
} from './lib/store';
import {
  applyCompletion,
  applySkip,
  endsAtFor,
  remainingAt,
  shouldPersist,
} from './lib/timerEngine';
import { assembleSession } from './lib/sessions';
import { loadIntentionDraft, saveIntentionDraft } from './lib/intentions';
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
} from './lib/focusAreas';
import { runLocalMigrations } from './lib/storage/migrations';
import { useAuth } from './lib/authProvider';
import { isTodayInTz } from './lib/timezone';
import { loadSyncState, onSyncStateChange } from './lib/sync/syncState';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  shouldShowFocusReminder,
  markReminderShown,
} from './lib/notificationPrefs';

/* Boot once: restore settings, history and the paused timer position. */
const BOOT = (() => {
  // Advance the local storage schema before any data load (idempotent).
  runLocalMigrations();
  const settings = loadSettings();
  const snap = loadSnapshot();
  const mode: Mode = snap?.mode ?? 'focus';
  const total = snap?.mode === mode ? snap.total : durationFor(mode, settings);
  const remaining = snap?.mode === mode ? Math.min(snap.remaining, total) : total;
  const intentionDraft = loadIntentionDraft();
  const areas = loadFocusAreas();
  const selectedAreaId = loadSelectedArea(areas);
  const projects = loadProjects();
  const tasks = loadTasks();
  const ivyPlans = loadPlans();
  const timeBlocks = loadBlocks();
  const skills = loadSkills();
  const frogLog = loadFrogLog();
  const goals = loadGoals();
  const chatHistory = loadChatHistory();
  const habits = loadHabits();
  const habitLog = loadHabitLog();
  const lifeAreas = loadLifeAreas();
  const journal = loadJournal();
  const energyLog = loadEnergyLog();
  const sprints = loadSprints();
  const objectives = loadObjectives();
  const phases = loadPhases();
  const selectedProjectId = loadSelectedProject(projects);
  // Round metadata is captured at arming time; boot arms the current round.
  const roundMeta =
    mode === 'focus'
      ? armRoundFocus(intentionDraft, selectedAreaId, areas)
      : { intention: null, areaId: null };
  return {
    settings,
    history: loadHistory(),
    mode,
    total,
    remaining,
    cycle: snap?.cycle ?? 0,
    roundMin: mode === 'focus' ? settings.focusMin : 0,
    intentionDraft,
    areas,
    selectedAreaId,
    projects,
    tasks,
    ivyPlans,
    timeBlocks,
    skills,
    frogLog,
    goals,
    chatHistory,
    habits,
    habitLog,
    lifeAreas,
    journal,
    energyLog,
    sprints,
    objectives,
    phases,
    selectedProjectId,
    roundIntention: roundMeta.intention,
    roundAreaId: roundMeta.areaId,
    roundProjectId: mode === 'focus' ? selectedProjectId : null,
    roundTaskId: null,
  };
})();

export default function App() {
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
  const [announce, setAnnounce] = useState('');
  const [intentionDraft, setIntentionDraft] = useState(BOOT.intentionDraft);
  const [areas, setAreas] = useState(BOOT.areas);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(BOOT.selectedAreaId);
  const [projects, setProjects] = useState<Project[]>(BOOT.projects);
  const [tasks, setTasks] = useState<Task[]>(BOOT.tasks);
  const [ivyPlans, setIvyPlans] = useState(BOOT.ivyPlans);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(BOOT.timeBlocks);
  const [skills, setSkills] = useState<Skill[]>(BOOT.skills);
  const [frogLog, setFrogLog] = useState<FrogLog>(BOOT.frogLog);
  const [goals, setGoals] = useState<Goal[]>(BOOT.goals);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(BOOT.chatHistory);
  const [habits, setHabits] = useState<Habit[]>(BOOT.habits);
  const [habitLog, setHabitLog] = useState<HabitLog>(BOOT.habitLog);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>(BOOT.lifeAreas);
  const [journal, setJournal] = useState<Journal>(BOOT.journal);
  const [energyLog, setEnergyLog] = useState<EnergyEntry[]>(BOOT.energyLog);
  const [sprints, setSprints] = useState<Sprint[]>(BOOT.sprints);
  const [objectives, setObjectives] = useState<Objective[]>(BOOT.objectives);
  const [phases, setPhases] = useState<WaterfallPhase[]>(BOOT.phases);
  const [theme, setTheme] = useState<UITheme>(loadTheme);
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboardingSeen());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(BOOT.selectedProjectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    saveSelectedProject(id);
    // A task belongs to exactly one project — clear it on project switch.
    setSelectedTaskId(null);
  };

  const handleSelectTask = (id: string | null) => {
    setSelectedTaskId(id);
  };

  const endsAtRef = useRef(0);
  const runningRef = useRef(false);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  const cycleRef = useRef(cycle);
  const totalRef = useRef(total);
  const remainingRef = useRef(remaining);
  // Focus minutes belonging to the round that is currently armed/running.
  const roundMinRef = useRef(BOOT.roundMin);
  // Intention + area + project are captured once, at arming time — a running round
  // keeps exactly these values no matter what the user edits afterwards.
  const roundIntentionRef = useRef<string | null>(BOOT.roundIntention);
  const roundAreaIdRef = useRef<string | null>(BOOT.roundAreaId);
  const roundProjectIdRef = useRef<string | null>(BOOT.roundProjectId);
  const roundTaskIdRef = useRef<string | null>(BOOT.roundTaskId);
  const intentionDraftRef = useRef(intentionDraft);
  const areasRef = useRef(areas);
  const selectedAreaIdRef = useRef(selectedAreaId);
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const tasksRef = useRef(tasks);
  modeRef.current = mode;
  settingsRef.current = settings;
  cycleRef.current = cycle;
  totalRef.current = total;
  remainingRef.current = remaining;
  intentionDraftRef.current = intentionDraft;
  areasRef.current = areas;
  selectedAreaIdRef.current = selectedAreaId;
  selectedProjectIdRef.current = selectedProjectId;
  selectedTaskIdRef.current = selectedTaskId;
  tasksRef.current = tasks;

  const captureRoundMeta = () => {
    const meta = armRoundFocus(
      intentionDraftRef.current,
      selectedAreaIdRef.current,
      areasRef.current,
    );
    roundIntentionRef.current = meta.intention;
    roundAreaIdRef.current = meta.areaId;
    roundProjectIdRef.current = selectedProjectIdRef.current;
    roundTaskIdRef.current = roundProjectIdRef.current !== null ? selectedTaskIdRef.current : null;
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
    if (entry) setHistory((h) => [...h, entry]);
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

  /* ---------- persistence ---------- */

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    saveHistory(history);
  }, [history]);
  useEffect(() => saveIntentionDraft(intentionDraft), [intentionDraft]);
  useEffect(() => {
    saveFocusAreas(areas);
  }, [areas]);
  useEffect(() => {
    saveProjects(projects);
  }, [projects]);
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);
  useEffect(() => {
    savePlans(ivyPlans);
  }, [ivyPlans]);
  useEffect(() => {
    saveBlocks(timeBlocks);
  }, [timeBlocks]);
  useEffect(() => {
    saveSkills(skills);
  }, [skills]);
  useEffect(() => {
    saveFrogLog(frogLog);
  }, [frogLog]);
  useEffect(() => {
    saveGoals(goals);
  }, [goals]);
  useEffect(() => {
    saveChatHistory(chatHistory);
  }, [chatHistory]);
  useEffect(() => {
    saveHabits(habits);
  }, [habits]);
  useEffect(() => {
    saveHabitLog(habitLog);
  }, [habitLog]);
  useEffect(() => {
    saveLifeAreas(lifeAreas);
  }, [lifeAreas]);
  useEffect(() => {
    saveJournal(journal);
  }, [journal]);
  useEffect(() => {
    saveEnergyLog(energyLog);
  }, [energyLog]);
  useEffect(() => {
    saveSprints(sprints);
  }, [sprints]);
  useEffect(() => {
    saveObjectives(objectives);
  }, [objectives]);
  useEffect(() => {
    savePhases(phases);
  }, [phases]);
  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  // Premium Polish: keep the applied theme in sync with state.
  const modeWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    applyTheme(theme, modeWrapRef.current);
  }, [theme, mode]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingSeen();
  };
  useEffect(() => saveSelectedArea(selectedAreaId), [selectedAreaId]);

  // Ivy Lee carry-over: unfinished tasks roll into a fresh day's list once
  // the effective timezone is known.
  useEffect(() => {
    setIvyPlans((current) => {
      const { plans, changed } = carryForNewDay(current, auth.timezone);
      return changed ? plans : current;
    });
  }, [auth.timezone]);

  // Deadline reminders: one browser notice per project per day while the tab
  // is open. Gated on Pro (notifications are a Pro feature) + the user prefs.
  useEffect(() => {
    if (!auth.isPro || !settings.notifications) return;
    if (!loadNotificationPrefs().deadlineReminders) return;
    const now = Date.now();
    const due = deadlinesDue(projects, now);
    if (due.length === 0) return;
    const dayKey = localDayKey(now);
    const reminded = loadDeadlineReminders();
    let next = reminded;
    for (const { project, msLeft } of due) {
      if (next[project.id] === dayKey) continue;
      const hours = Math.max(1, Math.round(msLeft / 3600000));
      showNotification(
        `Deadline approaching: ${project.name}`,
        `Due in ~${hours}h. Finish strong — open Moneo to plan the last push.`,
      );
      next = markDeadlineReminded(next, project.id, dayKey);
    }
    if (next !== reminded) saveDeadlineReminders(next);
  }, [projects, settings.notifications, auth.isPro]);

  // Request notification permission when notifications are enabled
  useEffect(() => {
    if (settings.notifications) {
      requestNotificationPermission();
    }
  }, [settings.notifications]);

  // In-app focus reminder: check every 30s while the tab is open.
  useEffect(() => {
    const check = () => {
      const prefs = loadNotificationPrefs();
      if (!shouldShowFocusReminder(prefs)) return;
      saveNotificationPrefs(markReminderShown(prefs));
      showNotification('Time to focus', 'Your focus reminder is due. Start a round!');
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);
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
          <div ref={modeWrapRef} data-mode={mode} className="relative min-h-screen overflow-hidden">
            {/* ambient layers */}
            <div
              className={`bg-glow bg-glow-focus ${mode === 'focus' ? 'is-on' : ''}`}
              aria-hidden
            />
            <div
              className={`bg-glow bg-glow-short ${mode === 'short' ? 'is-on' : ''}`}
              aria-hidden
            />
            <div className={`bg-glow bg-glow-long ${mode === 'long' ? 'is-on' : ''}`} aria-hidden />
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
                    style={{ boxShadow: '0 8px 24px -8px rgb(var(--accent-rgb) / 0.45)' }}
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
                      className={`relative inline-block h-2 w-2 rounded-full ${running ? 'ping-dot' : ''}`}
                      style={{ background: 'var(--accent)', color: 'var(--accent)' }}
                    />
                    <span className="font-mono text-[12px] text-sage">
                      today&nbsp;
                      <span className="font-semibold text-cream">
                        {minutesToday > 0 ? fmtMinutes(minutesToday) : '0m'}
                      </span>
                    </span>
                  </div>
                  <AccountButton />
                </div>
              </header>

              {/* main */}
              <main className="mt-7 grid gap-6 lg:grid-cols-[7fr_5fr]">
                <div className="reveal" style={{ animationDelay: '90ms' }}>
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
                      if (!runningRef.current && modeRef.current === 'focus') start();
                    }}
                    areas={activeAreas(areas)}
                    selectedAreaId={selectedAreaId}
                    onSelectArea={setSelectedAreaId}
                    onCreateArea={handleCreateArea}
                    onRenameArea={handleRenameArea}
                    onDeleteArea={handleDeleteArea}
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={handleSelectProject}
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={handleSelectTask}
                  />
                </div>

                <div className="flex flex-col gap-6">
                  <div className="reveal" style={{ animationDelay: '135ms' }}>
                    <GrowthCard history={history} />
                  </div>
                  <div className="reveal" style={{ animationDelay: '180ms' }}>
                    <InsightsCard
                      history={history}
                      areas={areas}
                      projects={projects}
                      tasks={tasks}
                      timezone={auth.timezone}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '225ms' }}>
                    <IvyLeeCard
                      plans={ivyPlans}
                      plansChange={setIvyPlans}
                      timezone={auth.timezone}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '270ms' }}>
                    <CalendarCard
                      history={history}
                      projects={projects}
                      timezone={auth.timezone}
                      isPro={auth.isPro}
                      blocksChange={setTimeBlocks}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '300ms' }}>
                    <MatrixCard
                      tasks={tasks}
                      history={history}
                      onTasksChange={setTasks}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '330ms' }}>
                    <FrogCard
                      tasks={tasks}
                      projects={projects}
                      frogLog={frogLog}
                      frogLogChange={setFrogLog}
                      onTasksChange={setTasks}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '360ms' }}>
                    <AssistantCard
                      messages={chatHistory}
                      messagesChange={setChatHistory}
                      tasks={tasks}
                      projects={projects}
                      history={history}
                      timezone={auth.timezone}
                      goals={goals}
                      selectedProjectId={selectedProjectId}
                      onTasksChange={setTasks}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '390ms' }}>
                    <GoalsCard
                      goals={goals}
                      goalsChange={setGoals}
                      projects={projects}
                      tasks={tasks}
                      onTasksChange={setTasks}
                      ivyPlans={ivyPlans}
                      onIvyPlansChange={setIvyPlans}
                      timezone={auth.timezone}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '420ms' }}>
                    <LifeCard
                      habits={habits}
                      habitsChange={setHabits}
                      habitLog={habitLog}
                      habitLogChange={setHabitLog}
                      lifeAreas={lifeAreas}
                      lifeAreasChange={setLifeAreas}
                      focusAreas={areas}
                      journal={journal}
                      journalChange={setJournal}
                      energyLog={energyLog}
                      energyLogChange={setEnergyLog}
                      history={history}
                      timezone={auth.timezone}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '450ms' }}>
                    <ProjectsCard
                      projects={projects}
                      history={history}
                      areas={areas}
                      tasks={tasks}
                      selectedProjectId={selectedProjectId}
                      onSelectProject={handleSelectProject}
                      onProjectsChange={setProjects}
                      onTasksChange={setTasks}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '480ms' }}>
                    <AgileCard
                      projects={projects}
                      tasks={tasks}
                      onTasksChange={setTasks}
                      sprints={sprints}
                      sprintsChange={setSprints}
                      phases={phases}
                      phasesChange={setPhases}
                      selectedProjectId={selectedProjectId}
                      onSelectProject={handleSelectProject}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '510ms' }}>
                    <OkrCard
                      objectives={objectives}
                      objectivesChange={setObjectives}
                      isPro={auth.isPro}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '540ms' }}>
                    <SkillsCard skills={skills} skillsChange={setSkills} isPro={auth.isPro} />
                  </div>
                  <div className="reveal" style={{ animationDelay: '570ms' }}>
                    <StatsCard
                      history={history}
                      settings={settings}
                      areas={areas}
                      projects={projects}
                      timezone={auth.timezone}
                      clearDisabled={syncState.initialized}
                      onClear={() => setHistory([])}
                      onHistoryAdd={(session) => setHistory((h) => [...h, session])}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '600ms' }}>
                    <ReportsCard
                      history={history}
                      areas={areas}
                      projects={projects}
                      tasks={tasks}
                      timezone={auth.timezone}
                    />
                  </div>
                  <div className="reveal" style={{ animationDelay: '630ms' }}>
                    <SettingsCard
                      settings={settings}
                      onChange={updateSettings}
                      theme={theme}
                      onThemeChange={setTheme}
                      isPro={auth.isPro}
                    />
                  </div>
                </div>
              </main>

              {/* footer */}
              <footer
                className="reveal mt-9 flex flex-col items-center justify-between gap-3 border-t border-line/70 pt-5 sm:flex-row"
                style={{ animationDelay: '360ms' }}
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

            {showOnboarding && <OnboardingModal onDone={dismissOnboarding} />}
          </div>
        }
      />
    </Routes>
  );
}
