import { useMemo, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import MonoNav, { type MonoTab } from './mono/MonoNav';
import MonoMore from './mono/MonoMore';
import MonoFocus from './mono/MonoFocus';
import MonoAzi from './mono/MonoAzi';
import MonoOrar from './mono/MonoOrar';
import MonoProiecte from './mono/MonoProiecte';
import MonoRapoarte from './mono/MonoRapoarte';
import MonoCrestere from './mono/MonoCrestere';
import GettingStarted from './components/GettingStarted';
import TabFallback from './components/TabFallback';
import MatrixCard from './components/MatrixCard';
import FrogCard from './components/FrogCard';
import LifeCard from './components/LifeCard';

const StatsCard = lazy(() => import('./components/StatsCard'));
const SettingsCard = lazy(() => import('./components/SettingsCard'));
const ReportsCard = lazy(() => import('./components/ReportsCard'));
const WeeklyRecapCard = lazy(() => import('./components/WeeklyRecapCard'));
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
const CalendarCard = lazy(() => import('./components/CalendarCard'));
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import HelpPage from './components/HelpPage';
import PricingPage from './components/PricingPage';
import {
  loadProjects,
  loadSelectedProject,
  saveSelectedProject,
  saveProjects,
  activeProjects,
  FREE_PROJECTS_LIMIT,
  type Project,
} from './lib/projects';
import { loadTasks, saveTasks, updateTaskStatus, type Task } from './lib/tasks';
import {
  loadPlans,
  planForDay,
  addTaskToDay,
  togglePlanTask,
  planDoneCount,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
} from './lib/ivyLee';
import { isEngagedUser } from './lib/engagement';
import UpNext from './components/UpNext';
import Disclosure from './components/Disclosure';
import { loadBlocks, type TimeBlock } from './lib/timeBlocks';
import { loadSkills, transitionAdvice, type Skill } from './lib/skills';
import { loadFrogLog, type FrogLog } from './lib/frog';
import { loadGoals, saveGoals, FREE_GOALS_LIMIT, type Goal } from './lib/goals';
import { planQuickStart } from './lib/quickstart';
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
import MorningRitual from './components/MorningRitual';
import ShutdownRitual from './components/ShutdownRitual';
import { OvercommitWarning } from './components/OvercommitWarning';
import {
  createI18n,
  loadDictionary,
  loadLocale,
  en as enDict,
  type Dictionary,
  type Locale,
} from './lib/i18n';
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
import {
  loadAtmosphere,
  saveAtmosphere,
  applyAtmosphere,
  type Atmosphere,
} from './mono/atmosphere';
import OnboardingModal from './components/OnboardingModal';
import {
  durationFor,
  loadHistory,
  loadSettings,
  loadSnapshot,
  type Mode,
  type Session,
  type Settings,
} from './lib/store';
import { loadIntentionDraft } from './lib/intentions';
import {
  activeAreas,
  armRoundFocus,
  loadFocusAreas,
  loadSelectedArea,
  saveSelectedArea,
} from './lib/focusAreas';
import { runLocalMigrations } from './lib/storage/migrations';
import { sessionProgressImpact, type SessionImpact } from './lib/progress';
import { useTimer } from './hooks/useTimer';
import { usePersonalDataPersistence } from './hooks/usePersonalDataPersistence';
import { useAppNotifications } from './hooks/useAppNotifications';
import { usePlannerState } from './hooks/usePlannerState';
import { useAuth } from './lib/authProvider';
import { isTodayInTz, dayKeyInTz } from './lib/timezone';
import { loadSyncState, onSyncStateChange } from './lib/sync/syncState';

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
    selectedProjectId,
    roundIntention: roundMeta.intention,
    roundAreaId: roundMeta.areaId,
    roundProjectId: mode === 'focus' ? selectedProjectId : null,
    roundTaskId: null,
  };
})();

export default function App() {
  const auth = useAuth();
  const [tab, setTab] = useState<MonoTab>('focus');
  const [lastDone, setLastDone] = useState<{
    id: number;
    minutes: number;
    impact?: SessionImpact | null;
  } | null>(null);
  const [syncState, setSyncState] = useState(loadSyncState);
  useEffect(() => onSyncStateChange(() => setSyncState(loadSyncState())), []);
  const [settings, setSettings] = useState<Settings>(BOOT.settings);
  const [history, setHistory] = useState<Session[]>(BOOT.history);
  const [intentionDraft, setIntentionDraft] = useState(BOOT.intentionDraft);
  const [areas] = useState(BOOT.areas);
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
  const [theme, setTheme] = useState<UITheme>(loadTheme);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>(loadAtmosphere);
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboardingSeen());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(BOOT.selectedProjectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [i18nDict, setI18nDict] = useState<Dictionary>(enDict);

  // Load the active locale dictionary on boot and whenever the user switches.
  useEffect(() => {
    let cancelled = false;
    loadDictionary(locale).then((dict) => {
      if (!cancelled) setI18nDict(dict);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);
  // Faza 6 estimate learner: self-persisted profiles (not part of sync state).
  const [estProfiles, setEstProfiles] = useState<EstimateProfiles>(loadEstimateProfiles);
  useEffect(() => {
    saveEstimateProfiles(estProfiles);
  }, [estProfiles]);
  // App sits above LocaleProvider, so it localizes via a memo directly.
  const appI18n = useMemo(() => createI18n(locale, i18nDict), [locale, i18nDict]);
  const { t, fmtDur } = appI18n;

  const {
    mode,
    running,
    remaining,
    total,
    announce,
    start,
    toggle,
    reset,
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
      // The payoff meter reads history *with* the new entry included.
      const withEntry = [...history, entry];
      const impact = sessionProgressImpact(entry, {
        projects,
        tasks,
        goals,
        history: withEntry,
      });
      setHistory(withEntry);
      setLastDone({ id: entry.at, minutes: entry.min, impact });
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
    t,
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

  usePersonalDataPersistence({
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
  });

  useAppNotifications({
    projects,
    notificationsEnabled: settings.notifications,
    isPro: auth.isPro,
    t,
  });

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
  // Pro fonts only paint while auth.isPro — stored choice survives downgrade.
  const modeWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    applyTheme(theme, modeWrapRef.current, auth.isPro);
  }, [theme, mode, auth.isPro]);

  useEffect(() => {
    applyAtmosphere(atmosphere);
    saveAtmosphere(atmosphere);
  }, [atmosphere]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingSeen();
  };

  // First-run quickstart: one objective → suggested first step → focus round.
  // Honors Free caps: reuses an active project / skips the goal when full.
  const handleQuickStart = (goalTitle: string, taskTitle: string) => {
    const canProject = auth.isPro || projects.length < FREE_PROJECTS_LIMIT;
    const live = activeProjects(projects);
    const plan = planQuickStart({
      goalTitle,
      taskTitle,
      existingProject: canProject ? null : (live[0] ?? null),
      createGoal: auth.isPro || goals.filter((g) => !g.archived).length < FREE_GOALS_LIMIT,
    });
    if (!plan || (!canProject && live.length === 0)) {
      dismissOnboarding();
      return;
    }
    if (plan.createdProject) {
      const nextProjects = [...projects, plan.project];
      saveProjects(nextProjects);
      setProjects(nextProjects);
    }
    const nextTasks = [...tasks, plan.task];
    saveTasks(nextTasks);
    setTasks(nextTasks);
    if (plan.goal) {
      const nextGoals = [...goals, plan.goal];
      saveGoals(nextGoals);
      setGoals(nextGoals);
    }
    saveSelectedProject(plan.project.id);
    setSelectedProjectId(plan.project.id);
    setSelectedTaskId(plan.task.id);
    setIntentionDraft(plan.task.title);
    dismissOnboarding();
    setTab('focus');
  };
  useEffect(() => saveSelectedArea(selectedAreaId), [selectedAreaId]);
  /* ---------- focus areas (CRUD moves to Settings in MONO-5) ---------- */

  const showGettingStarted = history.length === 0 && projects.length === 0 && tasks.length === 0;
  const selectedTask = tasks.find((x) => x.id === selectedTaskId) ?? null;

  /* ---------- Mono Focus screen data ---------- */
  const focusStats = (() => {
    const todaySessions = history.filter((s) => isTodayInTz(s.at, auth.timezone));
    return {
      sessions: todaySessions.length,
      focusMin: todaySessions.reduce((sum, s) => sum + s.min, 0),
      done: tasks.filter(
        (x) =>
          x.status === 'completed' &&
          typeof x.completedAt === 'number' &&
          isTodayInTz(x.completedAt, auth.timezone),
      ).length,
    };
  })();
  const focusUpNext = tasks
    .filter((x) => x.status !== 'completed')
    .slice(0, 3)
    .map((x) => {
      const proj = projects.find((p) => p.id === x.projectId)?.name ?? null;
      const meta = [typeof x.estimateMin === 'number' ? fmtDur(x.estimateMin) : null, proj]
        .filter((v): v is string => v !== null)
        .join(' · ');
      return { id: x.id, title: x.title, meta, done: false };
    });
  const focusTaskOptions = (
    selectedProjectId ? tasks.filter((x) => x.projectId === selectedProjectId) : []
  ).map((x) => ({ id: x.id, title: x.title }));

  const handlePreset = (min: number) => {
    if (running) return;
    updateSettings({ focusMin: min });
    if (mode !== 'focus') switchMode('focus');
  };
  const handleToggleTask = (id: string) => {
    const found = tasks.find((x) => x.id === id);
    if (!found) return;
    setTasks(updateTaskStatus(tasks, id, found.status === 'completed' ? 'pending' : 'completed'));
  };

  /* ---------- Mono Azi screen data (Ivy plan of today) ---------- */
  const todayKey = dayKeyInTz(Date.now(), auth.timezone);
  const todayPlan = planForDay(ivyPlans, todayKey);
  const todayMaxTasks = auth.isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;

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
      <Route
        path="/help"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={setLocale}>
            <HelpPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/pricing"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={setLocale}>
            <PricingPage />
          </LocaleProvider>
        }
      />
      <Route
        path="*"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={setLocale}>
            <div
              ref={modeWrapRef}
              data-mode={mode}
              data-focusing={running}
              data-atmosphere={atmosphere}
              className="atm-root relative min-h-screen overflow-hidden"
            >
              <p role="status" aria-live="polite" className="sr-only">
                {announce}
              </p>

              <MonoNav tab={tab} onTab={setTab} onNewSession={() => setTab('focus')} />
              <div className="mono mono-shell">
                <div className="mono-shell-inner">
                  {tab === 'focus' && (
                    <main>
                      <MonoFocus
                        mode={mode}
                        running={running}
                        remaining={remaining}
                        total={total}
                        focusMin={settings.focusMin}
                        intention={intentionDraft}
                        onIntention={setIntentionDraft}
                        onIntentionEnter={() => {
                          if (!running && mode === 'focus') start();
                        }}
                        areas={activeAreas(areas)}
                        selectedAreaId={selectedAreaId}
                        onSelectArea={setSelectedAreaId}
                        projects={projects}
                        selectedProjectId={selectedProjectId}
                        onSelectProject={handleSelectProject}
                        tasks={focusTaskOptions}
                        selectedTaskId={selectedTaskId}
                        onSelectTask={handleSelectTask}
                        stats={focusStats}
                        upNext={focusUpNext}
                        summary={lastDone}
                        onDismissSummary={() => setLastDone(null)}
                        estimatePomodoros={
                          selectedTask?.estimateMin
                            ? Math.max(1, Math.round(selectedTask.estimateMin / 25))
                            : undefined
                        }
                        taskTitle={selectedTask?.title}
                        onFeedback={handleSessionFeedback}
                        onToggle={toggle}
                        onReset={reset}
                        onPreset={handlePreset}
                        onToggleTask={handleToggleTask}
                        onSeePlan={() => setTab('today')}
                        atmosphere={atmosphere}
                        onAtmosphere={setAtmosphere}
                      />
                      {showGettingStarted && (
                        <div className="mono-pad atm-desk-below">
                          <GettingStarted onGo={setTab} />
                        </div>
                      )}
                    </main>
                  )}
                  {tab === 'today' && (
                    <main>
                      <MonoAzi
                        doneCount={planDoneCount(todayPlan)}
                        totalCount={todayPlan?.tasks.length ?? 0}
                        items={(todayPlan?.tasks ?? []).map((x) => ({
                          id: x.id,
                          text: x.text,
                          meta: typeof x.estimateMin === 'number' ? fmtDur(x.estimateMin) : '',
                          done: x.done,
                        }))}
                        maxTasks={todayMaxTasks}
                        morningLabel={t('today.morning')}
                        shutdownLabel={t('today.shutdown')}
                        onMorning={() => setMorningOpen(true)}
                        onShutdown={() => setShutdownOpen(true)}
                        onToggle={(id) => setIvyPlans(togglePlanTask(ivyPlans, todayKey, id))}
                        onAdd={(text) => {
                          const r = addTaskToDay(ivyPlans, todayKey, text, todayMaxTasks);
                          if (r.added) setIvyPlans(r.plans);
                        }}
                        estimates={
                          todayEstimates > 0 ? (
                            <div style={{ marginTop: 10 }}>
                              <p className="mono-meta">
                                {t('today.planned', {
                                  p: fmtDur(todayEstimates),
                                  a: fmtDur(todayCapacity),
                                })}
                              </p>
                              <div style={{ marginTop: 8 }}>
                                <OvercommitWarning
                                  plannedMin={todayEstimates}
                                  availableMin={todayCapacity}
                                />
                              </div>
                            </div>
                          ) : undefined
                        }
                        program={
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
                        }
                        more={
                          <>
                            <div className="mono-sec">
                              <FrogCard
                                tasks={tasks}
                                projects={projects}
                                frogLog={frogLog}
                                frogLogChange={setFrogLog}
                                onTasksChange={setTasks}
                                isPro={auth.isPro}
                              />
                            </div>
                            <div className="mono-sec">
                              <Disclosure
                                title={t('today.more')}
                                hint={t('today.moreHint')}
                                defaultOpen={engaged}
                              >
                                <MatrixCard
                                  tasks={tasks}
                                  history={history}
                                  onTasksChange={setTasks}
                                  isPro={auth.isPro}
                                />
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
                                  frogLog={frogLog}
                                  history={history}
                                  timezone={auth.timezone}
                                  isPro={auth.isPro}
                                />
                              </Disclosure>
                            </div>
                          </>
                        }
                      />
                    </main>
                  )}
                  {tab === 'orar' && (
                    <Suspense fallback={<TabFallback label="Schedule" />}>
                      <main>
                        <MonoOrar timezone={auth.timezone}>
                          <CalendarCard
                            history={history}
                            projects={projects}
                            timezone={auth.timezone}
                            isPro={auth.isPro}
                            blocks={timeBlocks}
                            blocksChange={setTimeBlocks}
                          />
                        </MonoOrar>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'plan' && (
                    <Suspense fallback={<TabFallback label="Plan" />}>
                      <main className="mt-2 grid items-stretch gap-5 md:grid-cols-2 md:gap-6">
                        <div className="reveal flex min-h-0 flex-col" style={{ animationDelay: '90ms' }}>
                          <GoalsCard
                            goals={goals}
                            goalsChange={setGoals}
                            projects={projects}
                            tasks={tasks}
                            onTasksChange={setTasks}
                            ivyPlans={ivyPlans}
                            onIvyPlansChange={setIvyPlans}
                            timezone={auth.timezone}
                            lifeAreas={lifeAreas}
                            isPro={auth.isPro}
                          />
                        </div>
                        <div className="reveal flex min-h-0 flex-col" style={{ animationDelay: '130ms' }}>
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
                            onTasksChange={setTasks}
                            isPro={auth.isPro}
                          />
                        </div>
                        <div className="reveal md:col-span-2" style={{ animationDelay: '150ms' }}>
                          <AiPathCard
                            projects={projects}
                            projectsChange={setProjects}
                            tasks={tasks}
                            tasksChange={setTasks}
                            ivyPlans={ivyPlans}
                            plansChange={setIvyPlans}
                            blocks={timeBlocks}
                            timezone={auth.timezone}
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
                              isPro={auth.isPro}
                            />
                          </div>
                          <div className="reveal" style={{ animationDelay: '210ms' }}>
                            <SkillsCard
                              skills={skills}
                              skillsChange={setSkills}
                              transitionTip={transitionAdvice(
                                skills,
                                tasks,
                                projects,
                                goals,
                                appI18n,
                              )}
                              isPro={auth.isPro}
                            />
                          </div>
                        </Disclosure>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'growth' && (
                    <Suspense fallback={<TabFallback label="Growth" />}>
                      <main>
                        <MonoCrestere>
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
                          <div className="reveal mono-growth-span" style={{ animationDelay: '170ms' }}>
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
                          <div
                            className="reveal mono-growth-span md:hidden"
                            style={{ animationDelay: '210ms' }}
                          >
                            {lifeMapCard}
                          </div>
                        </MonoCrestere>
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
                      <main>
                        <MonoProiecte activeCount={projects.filter((p) => !p.archived).length}>
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
                          <div className="mono-sec">
                            <Disclosure
                              title={t('today.advPlan')}
                              hint={t('today.advAgileHint')}
                              defaultOpen={engaged}
                            >
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
                            </Disclosure>
                          </div>
                        </MonoProiecte>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'reports' && (
                    <Suspense fallback={<TabFallback label="Reports" />}>
                      <main>
                        <MonoRapoarte>
                          <div className="reveal" style={{ animationDelay: '60ms' }}>
                            <WeeklyRecapCard
                              history={history}
                              projects={projects}
                              tasks={tasks}
                              goals={goals}
                              timezone={auth.timezone}
                            />
                          </div>
                          <div className="reveal mono-sec" style={{ animationDelay: '110ms' }}>
                            <ReportsCard
                              history={history}
                              areas={areas}
                              projects={projects}
                              tasks={tasks}
                              timezone={auth.timezone}
                              capacityMin={settings.weeklyCapacityMin}
                              isPro={auth.isPro}
                            />
                          </div>
                        </MonoRapoarte>
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

                  {tab === 'more' && (
                    <main className="mt-4">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <MonoMore tab={tab} onOpen={setTab} />
                      </div>
                    </main>
                  )}
                </div>
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
              {showOnboarding && (
                <OnboardingModal onDone={dismissOnboarding} onQuickStart={handleQuickStart} />
              )}
            </div>
          </LocaleProvider>
        }
      />
    </Routes>
  );
}
