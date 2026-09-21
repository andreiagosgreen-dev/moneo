import { useMemo, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import TimerCard from './components/TimerCard';
import TopNav, { type NavTab } from './components/TopNav';
import GettingStarted from './components/GettingStarted';
import CommandCenter from './components/CommandCenter';
import CommandPalette from './components/CommandPalette';
import TabFallback from './components/TabFallback';
import IvyLeeCard from './components/IvyLeeCard';
import CalendarCard from './components/CalendarCard';
import MatrixCard from './components/MatrixCard';
import FrogCard from './components/FrogCard';
import LifeCard from './components/LifeCard';

const StatsCard = lazy(() => import('./components/StatsCard'));
const SettingsCard = lazy(() => import('./components/SettingsCard'));
const ReportsCard = lazy(() => import('./components/ReportsCard'));
const GrowthCard = lazy(() => import('./components/GrowthCard'));
const PricingCard = lazy(() => import('./components/PricingCard'));
const ProjectsCard = lazy(() => import('./components/ProjectsCard'));
const InsightsCard = lazy(() => import('./components/InsightsCard'));
const AssistantCard = lazy(() => import('./components/AssistantCard'));
const GoalsCard = lazy(() => import('./components/GoalsCard'));
const AgileCard = lazy(() => import('./components/AgileCard'));
const OkrCard = lazy(() => import('./components/OkrCard'));
const SkillsCard = lazy(() => import('./components/SkillsCard'));
const LifeMapCard = lazy(() => import('./components/LifeMapCard'));
const LanguageCard = lazy(() => import('./components/LanguageCard'));
const AiPathCard = lazy(() => import('./components/AiPathCard'));
const GraphCard = lazy(() => import('./components/GraphCard'));
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import HelpPage from './components/HelpPage';
import LoginPage from './components/LoginPage';
import CabinetPage from './components/CabinetPage';
import PricingPage from './components/PricingPage';
import {
  loadProjects,
  loadSelectedProject,
  saveSelectedProject,
  type Project,
} from './lib/projects';
import { loadTasks, type Task } from './lib/tasks';
import { loadPlans } from './lib/ivyLee';
import { isEngagedUser } from './lib/engagement';
import UpNext from './components/UpNext';
import Disclosure from './components/Disclosure';
import { loadBlocks, type TimeBlock } from './lib/timeBlocks';
import { loadSkills, transitionAdvice, type Skill } from './lib/skills';
import { loadFrogLog, type FrogLog } from './lib/frog';
import { loadGoals, type Goal } from './lib/goals';
import { loadChatHistory, type ChatMessage } from './lib/assistant';
import { loadHabits, loadHabitLog, type Habit, type HabitLog } from './lib/habits';
import { loadLifeAreas, type LifeArea } from './lib/lifeAreas';
import { loadLifeMap, type LifeMapArea } from './lib/lifemap';
import { loadJournal, type Journal } from './lib/journal';
import { loadTimeOff } from './lib/journal';
import { loadEnergyLog, type EnergyEntry } from './lib/energy';
import { loadSprints, type Sprint } from './lib/sprints';
import { loadObjectives, type Objective } from './lib/okrs';
import { loadPhases, type WaterfallPhase } from './lib/waterfall';
import { loadLinks, type EntityLink } from './lib/entityLinks';
import { loadSavedFilters, type SavedFilter } from './lib/savedFilters';
import MorningRitual from './components/MorningRitual';
import ShutdownRitual from './components/ShutdownRitual';
import PostSessionReflection from './components/PostSessionReflection';
import { OvercommitWarning } from './components/OvercommitWarning';
import { createI18n, loadLocale, type Locale } from './lib/i18n';
import { LocaleProvider } from './lib/i18n/LocaleContext';
import {
  loadEstimateProfiles,
  recordFeedback,
  saveEstimateProfiles,
  scopeKey,
  type EstimateProfiles,
} from './lib/ai/learner';
import type { SessionFeedback } from './lib/ai/types';
import {
  applyTheme,
  loadTheme,
  loadOnboardingSeen,
  markOnboardingSeen,
  type UITheme,
} from './lib/theme';
import OnboardingModal from './components/OnboardingModal';
import {
  durationFor,
  fmtMinutes,
  loadHistory,
  loadSettings,
  loadSnapshot,
  showNotification,
  requestNotificationPermission,
  type Mode,
  type Session,
  type Settings,
} from './lib/store';
import { loadIntentionDraft } from './lib/intentions';
import {
  activeAreas,
  armRoundFocus,
  createFocusArea,
  loadFocusAreas,
  loadSelectedArea,
  markAreaDeleted,
  renameFocusArea,
  saveSelectedArea,
} from './lib/focusAreas';
import { runLocalMigrations } from './lib/storage/migrations';
import { useTimer } from './hooks/useTimer';
import { useAppPersistence } from './hooks/useAppPersistence';
import { useDeadlineReminders } from './hooks/useDeadlineReminders';
import { useTimeCapsules } from './hooks/useTimeCapsules';
import { useCelebrations } from './hooks/useCelebrations';
import CelebrationOverlay from './components/CelebrationOverlay';
import { usePlannerState } from './hooks/usePlannerState';
import { useAuth } from './lib/authProvider';
import { isTodayInTz } from './lib/timezone';
import { loadSyncState, onSyncStateChange } from './lib/sync/syncState';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  shouldShowFocusReminder,
  markReminderShown,
  shouldShowHabitReminder,
  markHabitShown,
  shouldShowDisconnectReminder,
  markDisconnectShown,
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
  const lifeMap = loadLifeMap();
  const journal = loadJournal();
  const timeOff = loadTimeOff();
  const energyLog = loadEnergyLog();
  const sprints = loadSprints();
  const objectives = loadObjectives();
  const phases = loadPhases();
  const links = loadLinks();
  const savedFilters = loadSavedFilters();
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
    lifeMap,
    journal,
    timeOff,
    energyLog,
    sprints,
    objectives,
    phases,
    links,
    savedFilters,
    selectedProjectId,
    roundIntention: roundMeta.intention,
    roundAreaId: roundMeta.areaId,
    roundProjectId: mode === 'focus' ? selectedProjectId : null,
    roundTaskId: null,
  };
})();

export default function App() {
  const auth = useAuth();
  const [tab, setTab] = useState<NavTab>('focus');
  const [syncState, setSyncState] = useState(loadSyncState);
  useEffect(() => onSyncStateChange(() => setSyncState(loadSyncState())), []);
  const [settings, setSettings] = useState<Settings>(BOOT.settings);
  const [history, setHistory] = useState<Session[]>(BOOT.history);
  const [intentionDraft, setIntentionDraft] = useState(BOOT.intentionDraft);
  const [areas, setAreas] = useState(BOOT.areas);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(BOOT.selectedAreaId);
  const [projects, setProjects] = useState<Project[]>(BOOT.projects);
  const [tasks, setTasks] = useState<Task[]>(BOOT.tasks);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(BOOT.timeBlocks);
  const [skills, setSkills] = useState<Skill[]>(BOOT.skills);
  const [frogLog, setFrogLog] = useState<FrogLog>(BOOT.frogLog);
  const [goals, setGoals] = useState<Goal[]>(BOOT.goals);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(BOOT.chatHistory);
  const [habits, setHabits] = useState<Habit[]>(BOOT.habits);
  const [habitLog, setHabitLog] = useState<HabitLog>(BOOT.habitLog);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>(BOOT.lifeAreas);
  const [lifeMap, setLifeMap] = useState<LifeMapArea[]>(BOOT.lifeMap);
  const [journal, setJournal] = useState<Journal>(BOOT.journal);
  const [timeOff, setTimeOff] = useState<string[]>(BOOT.timeOff);
  const [energyLog, setEnergyLog] = useState<EnergyEntry[]>(BOOT.energyLog);
  const [sprints, setSprints] = useState<Sprint[]>(BOOT.sprints);
  const [objectives, setObjectives] = useState<Objective[]>(BOOT.objectives);
  const [phases, setPhases] = useState<WaterfallPhase[]>(BOOT.phases);
  const [links, setLinks] = useState<EntityLink[]>(BOOT.links);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(BOOT.savedFilters);
  const [theme, setTheme] = useState<UITheme>(loadTheme);
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboardingSeen());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(BOOT.selectedProjectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reflectionSession, setReflectionSession] = useState<Session | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  // Faza 6 estimate learner: self-persisted profiles (not part of sync state).
  const [estProfiles, setEstProfiles] = useState<EstimateProfiles>(loadEstimateProfiles);
  useEffect(() => {
    saveEstimateProfiles(estProfiles);
  }, [estProfiles]);
  // App sits above LocaleProvider, so it localizes via a memo directly.
  const { t, fmtDur } = useMemo(() => createI18n(locale), [locale]);

  const {
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
  } = useTimer({
    settings,
    setSettings,
    getContext: () => ({
      intentionDraft,
      selectedAreaId,
      areas,
      selectedProjectId,
      selectedTaskId,
    }),
    onSession: (entry) => {
      setHistory((h) => [...h, entry]);
      if (loadNotificationPrefs().sessionReflection) setReflectionSession(entry);
    },
    initial: {
      mode: BOOT.mode,
      total: BOOT.total,
      remaining: BOOT.remaining,
      cycle: BOOT.cycle,
      roundMin: BOOT.roundMin,
      roundIntention: BOOT.roundIntention,
      roundAreaId: BOOT.roundAreaId,
      roundProjectId: BOOT.roundProjectId,
      roundTaskId: BOOT.roundTaskId,
    },
  });

  const {
    ivyPlans,
    setIvyPlans,
    morningOpen,
    setMorningOpen,
    shutdownOpen,
    setShutdownOpen,
    moveToTomorrow,
    todayEstimates,
    todayCapacity,
    frogEaten,
  } = usePlannerState({
    timezone: auth.timezone,
    isPro: auth.isPro,
    frogLog,
    timeBlocks,
  });

  useAppPersistence({
    settings,
    history,
    intentionDraft,
    areas,
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
    lifeMap,
    journal,
    timeOff,
    energyLog,
    sprints,
    objectives,
    phases,
    theme,
    links,
    savedFilters,
  });

  useDeadlineReminders(projects, settings.notifications, auth.isPro);
  useTimeCapsules(goals, settings.notifications, auth.isPro);
  const celebrations = useCelebrations(goals, tasks, history);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    saveSelectedProject(id);
    // A task belongs to exactly one project — clear it on project switch.
    setSelectedTaskId(null);
  };

  const handleSelectTask = (id: string | null) => {
    setSelectedTaskId(id);
  };

  const handleSessionFeedback = (kind: SessionFeedback, estimated: number, actual: number) => {
    setEstProfiles((prev) =>
      recordFeedback(prev, scopeKey(selectedProjectId, selectedTaskId), estimated, actual, kind),
    );
  };

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

  // Request notification permission when notifications are enabled
  useEffect(() => {
    if (settings.notifications) {
      requestNotificationPermission();
    }
  }, [settings.notifications]);

  // In-app reminders: check every 30s while the tab is open. Focus reminders
  // work for everyone; habit + disconnect nudges are Pro notifications.
  useEffect(() => {
    const check = () => {
      let prefs = loadNotificationPrefs();
      if (shouldShowFocusReminder(prefs)) {
        prefs = markReminderShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Time to focus', 'Your focus reminder is due. Start a round!');
      }
      if (auth.isPro && shouldShowHabitReminder(prefs)) {
        prefs = markHabitShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Habits check-in', "Close out today's habits before bed.");
      }
      if (auth.isPro && shouldShowDisconnectReminder(prefs)) {
        prefs = markDisconnectShown(prefs);
        saveNotificationPrefs(prefs);
        showNotification('Time to disconnect', 'Work is done — rest is productive too.');
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [auth.isPro]);
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

  const showGettingStarted = history.length === 0 && projects.length === 0 && tasks.length === 0;
  const selectedTask = tasks.find((x) => x.id === selectedTaskId) ?? null;

  // Progressive disclosure (Roadmap Faza 2): brand-new workspaces see only
  // the calm core flow; everything else unfolds after first sessions.
  const engaged = isEngagedUser(history, projects);

  // Life Map (Roadmap Faza 3): one element, mounted either in the Map tab
  // (desktop + mobile) or as a section inside Growth on small screens —
  // the two locations are mutually exclusive, so state stays single-source.
  const lifeMapCard = (
    <LifeMapCard
      areas={lifeMap}
      areasChange={setLifeMap}
      goals={goals}
      projects={projects}
      habits={habits}
      habitsChange={setHabits}
      habitLog={habitLog}
      history={history}
      blocks={timeBlocks}
      blocksChange={setTimeBlocks}
      ivyPlans={ivyPlans}
      onIvyPlansChange={setIvyPlans}
      timezone={auth.timezone}
      isPro={auth.isPro}
    />
  );

  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/help" element={<HelpPage />} />
      <Route
        path="/login"
        element={
          <LocaleProvider locale={locale} onLocaleChange={setLocale}>
            <LoginPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/account"
        element={
          <LocaleProvider locale={locale} onLocaleChange={setLocale}>
            <CabinetPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/pricing"
        element={
          <LocaleProvider locale={locale} onLocaleChange={setLocale}>
            <PricingPage />
          </LocaleProvider>
        }
      />
      <Route
        path="*"
        element={
          <LocaleProvider locale={locale} onLocaleChange={setLocale}>
            <div
              ref={modeWrapRef}
              data-mode={mode}
              data-focusing={running}
              className="relative min-h-screen overflow-hidden"
            >
              {/* ambient layers */}
              <div
                className={`bg-glow bg-glow-focus ${mode === 'focus' ? 'is-on' : ''}`}
                aria-hidden
              />
              <div
                className={`bg-glow bg-glow-short ${mode === 'short' ? 'is-on' : ''}`}
                aria-hidden
              />
              <div
                className={`bg-glow bg-glow-long ${mode === 'long' ? 'is-on' : ''}`}
                aria-hidden
              />
              <div className="bg-grid" aria-hidden />
              <div className="bg-grain" aria-hidden />
              <p role="status" aria-live="polite" className="sr-only">
                {announce}
              </p>

              <TopNav
                tab={tab}
                onTab={setTab}
                todayText={minutesToday > 0 ? fmtMinutes(minutesToday) : '0m'}
                tasks={tasks}
                projects={projects}
                goals={goals}
                onOpenPalette={() => setPaletteOpen(true)}
              />
              <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onTab={setTab}
                tasks={tasks}
                projects={projects}
                goals={goals}
                running={running}
                onToggleTimer={toggle}
                onSelectProject={(id) => {
                  handleSelectProject(id);
                  setTab('focus');
                }}
                onSelectTask={(id, projectId) => {
                  handleSelectProject(projectId);
                  handleSelectTask(id);
                  setTab('focus');
                }}
              />
              <div className="relative z-10 mx-auto max-w-7xl px-4 pb-6 pt-24 sm:px-6">
                {tab === 'focus' && (
                  <main className="mt-4 grid gap-6 lg:grid-cols-[7fr_5fr] lg:gap-8">
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
                          if (!running && mode === 'focus') start();
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
                        estimatePomodoros={
                          selectedTask?.estimateMin
                            ? Math.max(1, Math.round(selectedTask.estimateMin / 25))
                            : undefined
                        }
                        taskTitle={selectedTask?.title}
                        onFeedback={handleSessionFeedback}
                      />
                    </div>
                    <div className="dim-in-focus flex flex-col gap-6">
                      {showGettingStarted && (
                        <div className="reveal" style={{ animationDelay: '140ms' }}>
                          <GettingStarted onGo={setTab} />
                        </div>
                      )}
                      {!showGettingStarted && (
                        <div className="reveal" style={{ animationDelay: '140ms' }}>
                          <CommandCenter
                            projects={projects}
                            tasks={tasks}
                            goals={goals}
                            sprints={sprints}
                            history={history}
                            areas={areas}
                            habits={habits}
                            habitLog={habitLog}
                            timezone={auth.timezone}
                            selectedProjectId={selectedProjectId}
                            selectedTaskId={selectedTaskId}
                          />
                        </div>
                      )}
                    </div>
                  </main>
                )}
                {tab === 'today' && (
                  <main className="mt-4 grid items-start gap-6 md:grid-cols-2 md:gap-8">
                    <div className="reveal md:col-span-2" style={{ animationDelay: '60ms' }}>
                      <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5 sm:py-4">
                        <span
                          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
                          title={t('today.ritualsTitle')}
                        >
                          {t('today.rituals')}
                        </span>
                        <button
                          onClick={() => setMorningOpen(true)}
                          title={t('today.morningTitle')}
                          className="press btn-ghost rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold"
                        >
                          {t('today.morning')}
                        </button>
                        <button
                          onClick={() => setShutdownOpen(true)}
                          title={t('today.shutdownTitle')}
                          className="press btn-ghost rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold"
                        >
                          {t('today.shutdown')}
                        </button>
                        {todayEstimates > 0 && (
                          <span className="ml-auto font-mono text-[11px] text-sage">
                            {t('today.planned', {
                              p: fmtDur(todayEstimates),
                              a: fmtDur(todayCapacity),
                            })}
                          </span>
                        )}
                      </div>
                      {todayEstimates > 0 && (
                        <div className="mt-2">
                          <OvercommitWarning
                            plannedMin={todayEstimates}
                            availableMin={todayCapacity}
                          />
                        </div>
                      )}
                    </div>
                    <div className="reveal" style={{ animationDelay: '75ms' }}>
                      <UpNext
                        blocks={timeBlocks}
                        tasks={tasks}
                        projects={projects}
                        goals={goals}
                        plans={ivyPlans}
                        plansChange={setIvyPlans}
                        timezone={auth.timezone}
                        isPro={auth.isPro}
                      />
                    </div>
                    <div className="reveal" style={{ animationDelay: '90ms' }}>
                      <IvyLeeCard
                        plans={ivyPlans}
                        plansChange={setIvyPlans}
                        timezone={auth.timezone}
                        isPro={auth.isPro}
                        tasks={tasks}
                        onTasksChange={setTasks}
                      />
                    </div>
                    <div className="reveal" style={{ animationDelay: '130ms' }}>
                      <FrogCard
                        tasks={tasks}
                        projects={projects}
                        frogLog={frogLog}
                        frogLogChange={setFrogLog}
                        onTasksChange={setTasks}
                        isPro={auth.isPro}
                      />
                    </div>
                    <Disclosure
                      title={t('today.more')}
                      hint={t('today.moreHint')}
                      defaultOpen={engaged}
                    >
                      <div className="reveal" style={{ animationDelay: '170ms' }}>
                        <MatrixCard
                          tasks={tasks}
                          history={history}
                          onTasksChange={setTasks}
                          isPro={auth.isPro}
                        />
                      </div>
                      <div className="reveal" style={{ animationDelay: '210ms' }}>
                        <CalendarCard
                          history={history}
                          projects={projects}
                          timezone={auth.timezone}
                          isPro={auth.isPro}
                          blocks={timeBlocks}
                          blocksChange={setTimeBlocks}
                        />
                      </div>
                      <div className="reveal md:col-span-2" style={{ animationDelay: '250ms' }}>
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
                          timeOff={timeOff}
                          timeOffChange={setTimeOff}
                          energyLog={energyLog}
                          energyLogChange={setEnergyLog}
                          goals={goals}
                          projects={projects}
                          skills={skills}
                          objectives={objectives}
                          links={links}
                          onLinksChange={setLinks}
                          frogLog={frogLog}
                          history={history}
                          timezone={auth.timezone}
                          isPro={auth.isPro}
                        />
                      </div>
                    </Disclosure>
                  </main>
                )}
                {tab === 'plan' && (
                  <Suspense fallback={<TabFallback label="Plan" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <GoalsCard
                          goals={goals}
                          goalsChange={setGoals}
                          projects={projects}
                          projectsChange={setProjects}
                          tasks={tasks}
                          onTasksChange={setTasks}
                          ivyPlans={ivyPlans}
                          onIvyPlansChange={setIvyPlans}
                          timezone={auth.timezone}
                          lifeAreas={lifeAreas}
                          links={links}
                          onLinksChange={setLinks}
                          skills={skills}
                          objectives={objectives}
                          isPro={auth.isPro}
                        />
                      </div>
                      <Disclosure
                        title={t('today.advPlan')}
                        hint={t('today.advSkillsHint')}
                        defaultOpen={engaged}
                      >
                        <div className="reveal" style={{ animationDelay: '170ms' }}>
                          <OkrCard
                            objectives={objectives}
                            objectivesChange={setObjectives}
                            links={links}
                            onLinksChange={setLinks}
                            goals={goals}
                            projects={projects}
                            skills={skills}
                            isPro={auth.isPro}
                          />
                        </div>
                        <div className="reveal" style={{ animationDelay: '210ms' }}>
                          <SkillsCard
                            skills={skills}
                            skillsChange={setSkills}
                            transitionTip={transitionAdvice(skills, tasks, projects, goals)}
                            links={links}
                            onLinksChange={setLinks}
                            goals={goals}
                            projects={projects}
                            objectives={objectives}
                            isPro={auth.isPro}
                          />
                        </div>
                      </Disclosure>
                    </main>
                  </Suspense>
                )}
                {tab === 'assistant' && (
                  <Suspense fallback={<TabFallback label="Assistant" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <AssistantCard
                          messages={chatHistory}
                          messagesChange={setChatHistory}
                          tasks={tasks}
                          projects={projects}
                          history={history}
                          timezone={auth.timezone}
                          goals={goals}
                          energyLog={energyLog}
                          ivyPlans={ivyPlans}
                          onIvyPlansChange={setIvyPlans}
                          selectedProjectId={selectedProjectId}
                          sprints={sprints}
                          onTasksChange={setTasks}
                          isPro={auth.isPro}
                        />
                      </div>
                      <div className="reveal md:col-span-2" style={{ animationDelay: '130ms' }}>
                        <AiPathCard
                          projects={projects}
                          projectsChange={setProjects}
                          tasks={tasks}
                          tasksChange={setTasks}
                          goals={goals}
                          goalsChange={setGoals}
                          ivyPlans={ivyPlans}
                          plansChange={setIvyPlans}
                          blocks={timeBlocks}
                          timezone={auth.timezone}
                          isPro={auth.isPro}
                        />
                      </div>
                    </main>
                  </Suspense>
                )}
                {tab === 'growth' && (
                  <Suspense fallback={<TabFallback label="Growth" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <GrowthCard history={history} />
                      </div>
                      <div className="reveal" style={{ animationDelay: '130ms' }}>
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
                      <div className="reveal md:col-span-2" style={{ animationDelay: '170ms' }}>
                        <InsightsCard
                          history={history}
                          areas={areas}
                          projects={projects}
                          tasks={tasks}
                          timezone={auth.timezone}
                          goals={goals}
                          isPro={auth.isPro}
                          plans={ivyPlans}
                          plansChange={setIvyPlans}
                          blocks={timeBlocks}
                          blocksChange={setTimeBlocks}
                          onTasksChange={setTasks}
                          lifeMapAreas={lifeMap}
                          habitLog={habitLog}
                        />
                      </div>
                      <div className="reveal md:hidden" style={{ animationDelay: '210ms' }}>
                        {lifeMapCard}
                      </div>
                    </main>
                  </Suspense>
                )}
                {tab === 'map' && (
                  <Suspense fallback={<TabFallback label="Map" />}>
                    <main className="mt-4 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal md:col-span-2" style={{ animationDelay: '90ms' }}>
                        {lifeMapCard}
                      </div>
                    </main>
                  </Suspense>
                )}
                {tab === 'projects' && (
                  <Suspense fallback={<TabFallback label="Projects" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <ProjectsCard
                          projects={projects}
                          history={history}
                          areas={areas}
                          tasks={tasks}
                          selectedProjectId={selectedProjectId}
                          onSelectProject={handleSelectProject}
                          onProjectsChange={setProjects}
                          onTasksChange={setTasks}
                          links={links}
                          onLinksChange={setLinks}
                          goals={goals}
                          skills={skills}
                          objectives={objectives}
                          savedFilters={savedFilters}
                          onSavedFiltersChange={setSavedFilters}
                          isPro={auth.isPro}
                        />
                      </div>
                      <Disclosure
                        title={t('today.advPlan')}
                        hint={t('today.advAgileHint')}
                        defaultOpen={true}
                      >
                        <div className="reveal" style={{ animationDelay: '130ms' }}>
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
                      </Disclosure>
                    </main>
                  </Suspense>
                )}
                {tab === 'reports' && (
                  <Suspense fallback={<TabFallback label="Reports" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <ReportsCard
                          history={history}
                          areas={areas}
                          projects={projects}
                          tasks={tasks}
                          goals={goals}
                          skills={skills}
                          timezone={auth.timezone}
                          capacityMin={settings.weeklyCapacityMin}
                          isPro={auth.isPro}
                        />
                      </div>
                    </main>
                  </Suspense>
                )}
                {tab === 'graph' && (
                  <Suspense fallback={<TabFallback label="Graph" />}>
                    <main className="mt-2 grid items-start gap-6">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <GraphCard
                          links={links}
                          goals={goals}
                          projects={projects}
                          skills={skills}
                          objectives={objectives}
                        />
                      </div>
                    </main>
                  </Suspense>
                )}
                {tab === 'settings' && (
                  <Suspense fallback={<TabFallback label="Settings" />}>
                    <main className="mt-2 grid items-start gap-6 md:grid-cols-2">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <SettingsCard
                          settings={settings}
                          onChange={updateSettings}
                          theme={theme}
                          onThemeChange={setTheme}
                          isPro={auth.isPro}
                        />
                      </div>
                      <div className="reveal" style={{ animationDelay: '135ms' }}>
                        <LanguageCard />
                      </div>
                      <div className="reveal" style={{ animationDelay: '180ms' }}>
                        <PricingCard />
                      </div>
                    </main>
                  </Suspense>
                )}

                {/* footer */}
                <footer
                  className="reveal mt-9 flex flex-col items-center justify-between gap-3 border-t border-line/70 pt-5 sm:flex-row"
                  style={{ animationDelay: '360ms' }}
                >
                  <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <p className="font-mono text-[11px] text-faint">{t('footer.tagline')}</p>
                    <div className="flex items-center gap-4 font-mono text-[11px] text-faint">
                      <Link to="/help" className="hover:text-cream transition-colors">
                        {t('footer.help')}
                      </Link>
                      <Link to="/privacy" className="hover:text-cream transition-colors">
                        {t('footer.privacy')}
                      </Link>
                      <Link to="/terms" className="hover:text-cream transition-colors">
                        {t('footer.terms')}
                      </Link>
                    </div>
                  </div>
                  <p className="hidden items-center gap-2 font-mono text-[11px] text-faint sm:flex">
                    <span className="kbd">Space</span> {t('footer.startPause')}
                    <span className="kbd">R</span> {t('footer.reset')}
                  </p>
                </footer>
              </div>

              {morningOpen && (
                <MorningRitual
                  plans={ivyPlans}
                  plansChange={setIvyPlans}
                  tasks={tasks}
                  projects={projects}
                  goals={goals}
                  blocks={timeBlocks}
                  blocksChange={setTimeBlocks}
                  timezone={auth.timezone}
                  isPro={auth.isPro}
                  onDone={() => setMorningOpen(false)}
                />
              )}
              {shutdownOpen && (
                <ShutdownRitual
                  history={history}
                  plans={ivyPlans}
                  timezone={auth.timezone}
                  frogEaten={frogEaten}
                  onMoveToTomorrow={moveToTomorrow}
                  onDone={() => setShutdownOpen(false)}
                />
              )}
              {showOnboarding && <OnboardingModal onDone={dismissOnboarding} />}
              {reflectionSession && (
                <PostSessionReflection
                  session={reflectionSession}
                  journal={journal}
                  journalChange={setJournal}
                  timezone={auth.timezone}
                  onDone={() => setReflectionSession(null)}
                />
              )}
              {celebrations.current && (
                <CelebrationOverlay
                  celebration={celebrations.current}
                  onDone={celebrations.dismiss}
                />
              )}
            </div>
          </LocaleProvider>
        }
      />
    </Routes>
  );
}
