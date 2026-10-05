import { useMemo, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { loadBoot } from './app/boot';
import { useFocusExtras } from './app/useFocusExtras';
import { useAppToast } from './app/useAppToast';
import { useWelcomeEmail } from './app/useWelcomeEmail';
import MonoNav, { MONO_NAV_ITEMS, type MonoTab } from './mono/MonoNav';
import MonoMore from './mono/MonoMore';
import MonoHead from './mono/MonoHead';
import MonoEmpty from './mono/MonoEmpty';
import MonoBtn from './mono/MonoBtn';
import { MonoArt } from './mono/MonoArt';
import MonoFocus from './mono/MonoFocus';
import MonoAzi from './mono/MonoAzi';
import MonoHabitsCheckin from './mono/MonoHabitsCheckin';
import MonoWeek from './mono/MonoWeek';
import MonoWeekRecap from './mono/MonoWeekRecap';
import MonoCheckin from './mono/MonoCheckin';
import MonoReportInsights from './mono/MonoReportInsights';
import MonoOrar from './mono/MonoOrar';
import MonoProiecte from './mono/MonoProiecte';
import MonoInbox from './mono/MonoInbox';
import MonoTemplates from './mono/MonoTemplates';
import MonoToast from './mono/MonoToast';
import { track } from './lib/analytics';
import MonoRapoarte from './mono/MonoRapoarte';
import MonoCrestere from './mono/MonoCrestere';
import MonoViata from './mono/MonoViata';
import MonoReturn from './mono/MonoReturn';
import GettingStarted from './components/GettingStarted';
import TabFallback from './components/TabFallback';
import MatrixCard from './components/MatrixCard';
import FrogCard from './components/FrogCard';
import LifeCard from './components/LifeCard';

const StatsCard = lazy(() => import('./components/StatsCard'));
const MonoSettings = lazy(() => import('./mono/MonoSettings'));
const MonoMiscare = lazy(() => import('./mono/MonoMiscare'));
const ReportsCard = lazy(() => import('./components/ReportsCard'));
const WeeklyRecapCard = lazy(() => import('./components/WeeklyRecapCard'));
const GrowthCard = lazy(() => import('./components/GrowthCard'));
const ProjectsCard = lazy(() => import('./components/ProjectsCard'));
const InsightsCard = lazy(() => import('./components/InsightsCard'));
const AssistantCard = lazy(() => import('./components/AssistantCard'));
const GoalsCard = lazy(() => import('./components/GoalsCard'));
const AgileCard = lazy(() => import('./components/AgileCard'));
const OkrCard = lazy(() => import('./components/OkrCard'));
const SkillsCard = lazy(() => import('./components/SkillsCard'));
const LifeMapCard = lazy(() => import('./components/LifeMapCard'));
const AiPathCard = lazy(() => import('./components/AiPathCard'));
const CalendarCard = lazy(() => import('./components/CalendarCard'));
const GraphCard = lazy(() => import('./components/GraphCard'));
const MonoCelebrate = lazy(() => import('./mono/MonoCelebrate'));
const MonoRankCard = lazy(() => import('./mono/MonoRankCard'));
const LegalPage = lazy(() => import('./components/legal/LegalPage'));
import { LEGAL_DOCS, LEGAL_PATHS } from './lib/legal/seller';
import HelpPage from './components/HelpPage';
import PricingPage from './components/PricingPage';
import LoginPage from './components/LoginPage';
import CabinetPage from './components/CabinetPage';
import CalendarCallback from './components/CalendarCallback';
import ResetPasswordPage from './components/ResetPasswordPage';
import { titleForPath } from './lib/routeTitle';
import { isKnownClientRoute } from './lib/knownRoutes';
import MonoNotFound from './mono/MonoNotFound';
import CommandCenter from './components/CommandCenter';
import CommandPalette from './components/CommandPalette';
import PostSessionReflection from './components/PostSessionReflection';
import {
  loadProjects,
  saveSelectedProject,
  saveProjects,
  activeProjects,
  FREE_PROJECTS_LIMIT,
  localDayKey,
  type Project,
} from './lib/projects';
import { getMinutesForTask, loadTasks, removeTask, saveTasks, type Task } from './lib/tasks';
import { rhythmFor } from './lib/focusRhythm';
import { estimateVsActual } from './lib/estimates';
import type { AmbientLayer } from './lib/ambient';
import { MonoVacationBanner } from './mono/MonoVacation';
import { hasQuickTokens, parseQuickAdd } from './lib/quickAdd';
import { assignProject, createInboxTask, inboxTasks } from './lib/inbox';
import {
  applyTriage,
  buildSuggestions,
  snoozeToTomorrow,
  type Suggestion,
  type TriageAction,
} from './lib/triage';
import {
  loadPlans,
  planForDay,
  addTaskToDay,
  dayPlanHasLinkedTask,
  removePlanTask,
  IVY_MAX_TASKS,
  IVY_FREE_MAX_TASKS,
} from './lib/ivyLee';
import { togglePlanItem, syncPlanWithTasks } from './lib/planTaskSync';
import { isEngagedUser } from './lib/engagement';
import Disclosure from './components/Disclosure';
import {
  loadBlocks,
  nextFocusBlock,
  weekdayOfKey,
  minuteOfDayInTz,
  type TimeBlock,
} from './lib/timeBlocks';
import { loadSkills, transitionAdvice, type Skill } from './lib/skills';
import { loadFrogLog, pickFrog, recordFrog, saveFrogLog, type FrogLog } from './lib/frog';
import { mottoForDay } from './lib/guidance/mottos';
import { buildLifeHubSnapshot } from './lib/guidance/lifeProgress';
import {
  loadGoals,
  saveGoals,
  createGoalObject,
  FREE_GOALS_LIMIT,
  type Goal,
  type GoalLevel,
} from './lib/goals';
import { syncExerciseGoals } from './lib/fitness/targets';
import { planQuickStart } from './lib/quickstart';
import { type ChatMessage } from './lib/assistant';
import {
  activeRoadmap,
  loadRoadmaps,
  recalcRoadmap,
  saveRoadmaps,
  syncStepsFromTasks,
  upsertRoadmap,
  type Roadmap,
} from './lib/ai/roadmap';
import MonoRoadmapStrip from './mono/MonoRoadmapStrip';
import {
  activeHabits,
  createHabitObject,
  FREE_HABITS_LIMIT,
  loadHabits,
  loadHabitLog,
  type Habit,
  type HabitLog,
} from './lib/habits';
import {
  addWorkout,
  deleteWorkout,
  FITNESS_HABIT_ICON,
  isMoving,
  loadWorkouts,
  markHabitDone,
  plannedOn,
  saveWorkouts,
  type WorkoutEntry,
  type WorkoutStore,
} from './lib/fitness/workouts';
import {
  isCustomId,
  resolveRoutine,
  routineTitle,
  upsertCustom,
  type CustomRoutine,
} from './lib/fitness/custom';
import { isProgramId } from './lib/fitness/program';
import { getActiveRun, setActiveRun, startRun } from './lib/fitness/player';
import MonoMoveToday from './mono/MonoMoveToday';
import type { HabitLink } from './mono/MonoWorkoutPlayer';
import {
  getLifeTemplate,
  instantiateLifeTemplate,
  isTemplateAvailable,
  type LifeTemplateId,
} from './lib/lifeTemplates';
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
import { loadNotificationPrefs } from './lib/notificationPrefs';
import MorningRitual from './components/MorningRitual';
import ShutdownRitual from './components/ShutdownRitual';
import { OvercommitWarning } from './components/OvercommitWarning';
import { createI18n, loadDictionary, type Dictionary, type Locale } from './lib/i18n';
import { initialAppTab } from './lib/appLaunch';
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
  resolveAtmosphere,
  type Atmosphere,
} from './mono/atmosphere';
import OnboardingModal from './components/OnboardingModal';
import { loadHistory, loadSettings, type Session, type Settings } from './lib/store';
import { activeAreas, saveSelectedArea } from './lib/focusAreas';
import { STORAGE_KEYS } from './lib/storage/storageKeys';
import { useProSync } from './hooks/useProSync';
import { sessionProgressImpact, type SessionImpact } from './lib/progress';
import { useTimer } from './hooks/useTimer';
import { usePersonalDataPersistence } from './hooks/usePersonalDataPersistence';
import { useAppNotifications } from './hooks/useAppNotifications';
import { usePlannerState } from './hooks/usePlannerState';
import { useAuth } from './lib/authProvider';
import { useGoogleCalendarEvents } from './hooks/useGoogleCalendarEvents';
import { useTimeCapsules } from './hooks/useTimeCapsules';
import { useMoments } from './hooks/useMoments';
import { computeXp, levelFromXp, rankForLevel } from './lib/xp';
import { saveCachedRank } from './lib/rankRewards';
import { computeBadges } from './lib/badges';
import { isTodayInTz, dayKeyInTz } from './lib/timezone';
import { dueStatus } from './lib/taskDue';
import { dayProgress } from './lib/dayProgress';
import { buildLastWeekRecap, loadRecapSeen, saveRecapSeen, shouldShowRecap } from './lib/weekRecap';
import { addDays, mondayOf } from './lib/dayKeys';
import { loadSyncState, onSyncStateChange } from './lib/sync/syncState';

/* Boot once: restore settings, history and the paused timer position. */
const BOOT = loadBoot();

export interface AppProps {
  initialLocale: Locale;
  initialDictionary: Dictionary;
}

export default function App({ initialLocale, initialDictionary }: AppProps) {
  const auth = useAuth();
  const [tab, setTab] = useState<MonoTab>(() =>
    initialAppTab(
      window.location.search,
      BOOT.history.length > 0 || BOOT.projects.length > 0 || BOOT.tasks.length > 0,
    ),
  );
  /** Origin tab after a jump-to-fill — Back button returns here. */
  const [returnTo, setReturnTo] = useState<MonoTab | null>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  /** Jump to fill something in another module; remember where we came from. */
  const goFill = (target: MonoTab) => {
    const from = tabRef.current;
    if (target === from) return;
    setReturnTo(from);
    setTab(target);
  };
  /** Explicit nav (rail / palette) — clear return trail. */
  const goNav = (target: MonoTab) => {
    setReturnTo(null);
    setTab(target);
  };
  const goBack = () => {
    if (!returnTo) return;
    const dest = returnTo;
    setReturnTo(null);
    setTab(dest);
  };
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
  const autoIntentionRef = useRef<string>('');
  const [areas] = useState(BOOT.areas);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(BOOT.selectedAreaId);
  const [projects, setProjects] = useState<Project[]>(BOOT.projects);
  const [tasks, setTasks] = useState<Task[]>(BOOT.tasks);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(BOOT.timeBlocks);
  const [skills, setSkills] = useState<Skill[]>(BOOT.skills);
  const [frogLog, setFrogLog] = useState<FrogLog>(BOOT.frogLog);
  const [goals, setGoals] = useState<Goal[]>(BOOT.goals);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(BOOT.chatHistory);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>(BOOT.roadmaps);
  const [habits, setHabits] = useState<Habit[]>(BOOT.habits);
  const [habitLog, setHabitLog] = useState<HabitLog>(BOOT.habitLog);
  const [workoutStore, setWorkoutStore] = useState<WorkoutStore>(loadWorkouts);
  const commitWorkouts = (next: WorkoutStore) => {
    setWorkoutStore(next);
    saveWorkouts(next);
  };
  /** Move → exercise → "Add to Goals": the exercise goal mirrored as a Goal. */
  const addExerciseGoal = (title: string, level: GoalLevel): string | null => {
    if (!auth.isPro && goals.filter((g) => !g.archived).length >= FREE_GOALS_LIMIT) return null;
    const goal = createGoalObject(goals, title, level);
    if (!goal) return null;
    const next = [...goals, goal];
    saveGoals(next);
    setGoals(next);
    return goal.id;
  };
  // Exercise goals keep their mirrored Goal's progress current.
  useEffect(() => {
    const next = syncExerciseGoals(goals, workoutStore.targets, workoutStore.log);
    if (next === goals) return;
    saveGoals(next);
    setGoals(next);
  }, [goals, workoutStore]);
  const handleWorkoutSave = (entry: WorkoutEntry, link: HabitLink, routine?: CustomRoutine) => {
    let habitId: string | undefined;
    if (link.kind === 'habit') {
      habitId = link.id;
    } else if (link.kind === 'create') {
      const room = auth.isPro || activeHabits(habits).length < FREE_HABITS_LIMIT;
      const habit = room ? createHabitObject(link.name, 'weekly', 3, FITNESS_HABIT_ICON) : null;
      if (habit) {
        setHabits((prev) => [...prev, habit]);
        habitId = habit.id;
      }
    }
    if (habitId) {
      const id = habitId;
      setHabitLog((prev) => markHabitDone(prev, id, entry.day));
    }
    const logged = addWorkout(workoutStore, entry);
    commitWorkouts({
      ...(routine ? upsertCustom(logged, routine) : logged),
      habitId: habitId ?? workoutStore.habitId,
    });
  };
  const startWorkoutFromToday = (routineId: string) => {
    if (!getActiveRun()) {
      const steps =
        isCustomId(routineId) || isProgramId(routineId)
          ? resolveRoutine(workoutStore, routineId)?.steps
          : undefined;
      setActiveRun(startRun(routineId, Date.now(), workoutStore.log, steps));
    }
    goFill('move');
  };
  const moveForDay = (dayKey: string) => {
    const done = workoutStore.log.some((e) => e.day === dayKey);
    const planned = plannedOn(workoutStore, dayKey)
      .filter((id) => resolveRoutine(workoutStore, id))
      .map((id) => routineTitle(t, workoutStore, id));
    return done || planned.length > 0 ? { planned, done } : null;
  };
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
  const [reflectionSession, setReflectionSession] = useState<Session | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<UITheme>(loadTheme);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>(loadAtmosphere);
  const [showOnboarding, setShowOnboarding] = useState(() => !loadOnboardingSeen());
  // Funnel: count each first-run onboarding once per page load.
  const onboardingTrackedRef = useRef(false);
  useEffect(() => {
    if (!showOnboarding || onboardingTrackedRef.current) return;
    onboardingTrackedRef.current = true;
    track('onboarding_start');
  }, [showOnboarding]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(BOOT.selectedProjectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [i18nDict, setI18nDict] = useState<Dictionary>(initialDictionary);
  const localeRequestRef = useRef(0);
  const changeLocale = async (next: Locale) => {
    const request = ++localeRequestRef.current;
    if (next === locale) return;
    const dictionary = await loadDictionary(next);
    if (request !== localeRequestRef.current) return;
    setI18nDict(dictionary);
    setLocale(next);
  };
  // Faza 6 estimate learner: self-persisted profiles (not part of sync state).
  const [estProfiles, setEstProfiles] = useState<EstimateProfiles>(loadEstimateProfiles);
  useEffect(() => {
    saveEstimateProfiles(estProfiles);
  }, [estProfiles]);
  // App sits above LocaleProvider, so it localizes via a memo directly.
  const appI18n = useMemo(() => createI18n(locale, i18nDict), [locale, i18nDict]);
  const { t, fmtDur, fmtClock, fmtDayKey } = appI18n;
  const xp = useMemo(
    () => computeXp({ history, tasks, habitLog, phases, projects }),
    [history, tasks, habitLog, phases, projects],
  );
  const badges = useMemo(
    () => computeBadges({ history, tasks, habitLog, phases, projects, totalXp: xp.total }),
    [history, tasks, habitLog, phases, projects, xp.total],
  );
  const xpLevel = levelFromXp(xp.total).level;
  // Rank rewards (themes/sounds on Free) read the rank from this cache too.
  const xpRank = rankForLevel(xpLevel).id;
  useEffect(() => saveCachedRank(xpRank), [xpRank]);
  const moments = useMoments({ tasks, phases, projects, goals, history, level: xpLevel });

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
    setRoundLength,
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
      if (history.length === 0) track('first_focus_done', undefined, locale);
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
      moments.celebrateSession(entry);
      if (loadNotificationPrefs().sessionReflection) setReflectionSession(entry);
    },
    initial: {
      mode: BOOT.mode,
      total: BOOT.total,
      remaining: BOOT.remaining,
      cycle: BOOT.cycle,
      endsAt: BOOT.endsAt,
      roundMin: BOOT.roundMin,
      roundIntention: BOOT.roundIntention,
      roundAreaId: BOOT.roundAreaId,
      roundProjectId: BOOT.roundProjectId,
      roundTaskId: BOOT.roundTaskId,
    },
    t,
  });

  // Idle tab title follows client-side navigation; a live countdown wins.
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!running && remaining >= total) document.title = titleForPath(pathname, t);
  }, [pathname, running, remaining, total, t]);

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
    firstRun: showOnboarding,
    timeOff,
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
    links,
    savedFilters,
  });

  // Account sync rewrote these stores in localStorage — reload them into
  // state so the persistence effects never write a stale copy back.
  const reloadFromStorage = (keys: string[]) => {
    const reloaders: Record<string, () => void> = {
      [STORAGE_KEYS.history]: () => setHistory(loadHistory()),
      [STORAGE_KEYS.settings]: () => setSettings(loadSettings()),
      [STORAGE_KEYS.projects]: () => setProjects(loadProjects()),
      [STORAGE_KEYS.tasks]: () => setTasks(loadTasks()),
      [STORAGE_KEYS.goals]: () => setGoals(loadGoals()),
      [STORAGE_KEYS.objectives]: () => setObjectives(loadObjectives()),
      [STORAGE_KEYS.habits]: () => setHabits(loadHabits()),
      [STORAGE_KEYS.habitLog]: () => setHabitLog(loadHabitLog()),
      [STORAGE_KEYS.journal]: () => setJournal(loadJournal()),
      [STORAGE_KEYS.timeOff]: () => setTimeOff(loadTimeOff()),
      [STORAGE_KEYS.energyLog]: () => setEnergyLog(loadEnergyLog()),
      [STORAGE_KEYS.lifeAreas]: () => setLifeAreas(loadLifeAreas()),
      [STORAGE_KEYS.lifeMap]: () => setLifeMap(loadLifeMap()),
      [STORAGE_KEYS.skills]: () => setSkills(loadSkills()),
      [STORAGE_KEYS.timeBlocks]: () => setTimeBlocks(loadBlocks()),
      [STORAGE_KEYS.ivyPlans]: () => setIvyPlans(loadPlans()),
      [STORAGE_KEYS.frogLog]: () => setFrogLog(loadFrogLog()),
      [STORAGE_KEYS.sprints]: () => setSprints(loadSprints()),
      [STORAGE_KEYS.waterfall]: () => setPhases(loadPhases()),
      [STORAGE_KEYS.links]: () => setLinks(loadLinks()),
      [STORAGE_KEYS.savedFilters]: () => setSavedFilters(loadSavedFilters()),
      [STORAGE_KEYS.roadmaps]: () => setRoadmaps(loadRoadmaps()),
      [STORAGE_KEYS.workouts]: () => setWorkoutStore(loadWorkouts()),
    };
    for (const key of keys) reloaders[key]?.();
  };
  useProSync({
    userId: auth.user?.userId ?? null,
    isPro: auth.isPro,
    syncEnabled: syncState.initialized,
    onApplied: reloadFromStorage,
  });

  useAppNotifications({
    projects,
    notificationsEnabled: settings.notifications,
    isPro: auth.isPro,
    t,
  });

  const externalCalendarEvents = useGoogleCalendarEvents(auth.isPro, auth.timezone);
  useTimeCapsules(goals, settings.notifications, auth.isPro);

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

  /** Pick a decomposed goal/project leaf for the Focus timer. */
  const handleWorkFocus = (projectId: string, taskId: string | null) => {
    setSelectedProjectId(projectId);
    saveSelectedProject(projectId);
    setSelectedTaskId(taskId);
    goFill('focus');
  };

  const activeRm = activeRoadmap(roadmaps);

  // Refresh roadmap ETA from recent Focus minutes on the linked project.
  useEffect(() => {
    if (!activeRm?.projectId) return;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const mins = history
      .filter((s) => s.at >= weekAgo && s.projectId === activeRm.projectId)
      .reduce((sum, s) => sum + Math.max(0, s.min), 0);
    const perDay = Math.round(mins / 7);
    if (perDay < 5) return;
    if (Math.abs(perDay - (activeRm.actualMinPerDay || 0)) < 3) return;
    const next = recalcRoadmap(activeRm, perDay);
    const list = upsertRoadmap(roadmaps, next);
    setRoadmaps(list);
    saveRoadmaps(list);
  }, [history, activeRm, roadmaps]);

  // Focus/Projects → roadmap strip: mark steps done when linked tasks complete.
  useEffect(() => {
    if (!activeRm) return;
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const synced = syncStepsFromTasks(activeRm, (taskId) => {
      const task = byId.get(taskId);
      if (!task) return null;
      if (task.status === 'completed') return 'completed';
      if (task.status === 'pending' || task.status === 'in_progress') return 'pending';
      return 'other';
    });
    if (!synced) return;
    const list = upsertRoadmap(roadmaps, synced);
    setRoadmaps(list);
    saveRoadmaps(list);
  }, [tasks, activeRm, roadmaps]);

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

  // Pro interior packs only paint while auth.isPro — stored choice survives downgrade.
  const paintedAtmosphere = resolveAtmosphere(atmosphere, auth.isPro, xpRank);
  useEffect(() => {
    applyAtmosphere(paintedAtmosphere);
    saveAtmosphere(atmosphere);
  }, [atmosphere, paintedAtmosphere]);

  const [quickStartPending, setQuickStartPending] = useState(false);
  const dismissOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingSeen();
  };

  // First-run quickstart: one objective → suggested first step → focus round.
  // Honors Free caps: reuses an active project / skips the goal when full.
  const handleQuickStart = (goalTitle: string, taskTitle: string, startNow = true) => {
    track('onboarding_done', undefined, locale);
    const canProject = auth.isPro || projects.length < FREE_PROJECTS_LIMIT;
    const live = activeProjects(projects);
    const plan = planQuickStart({
      goalTitle,
      taskTitle,
      existingProject: canProject ? null : (live[0] ?? null),
      createGoal: auth.isPro || goals.filter((g) => !g.archived).length < FREE_GOALS_LIMIT,
      i18n: appI18n,
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
    if (!startNow) {
      // Saved for later: the step waits in today's plan, no timer.
      addLinkedTaskToPlan(plan.task);
      goNav('today');
      return;
    }
    goNav('focus');
    setQuickStartPending(true);
  };
  // The round captures intention/project/task at arming time, so start only
  // after the quickstart selection has rendered into the timer context.
  useEffect(() => {
    if (!quickStartPending) return;
    if (mode !== 'focus') {
      switchMode('focus');
      return;
    }
    setQuickStartPending(false);
    if (!running) start();
  }, [quickStartPending, running, mode, switchMode, start]);
  useEffect(() => saveSelectedArea(selectedAreaId), [selectedAreaId]);
  /* ---------- focus areas (CRUD moves to Settings in MONO-5) ---------- */

  const showGettingStarted = history.length === 0 && projects.length === 0 && tasks.length === 0;
  const selectedTask = tasks.find((x) => x.id === selectedTaskId) ?? null;

  /* ---------- Focus extras: ambient sound, wake lock, zen ---------- */
  const { focusPrefs, updateFocusPrefs, ambient, focusRootRef, zen, handleFocusToggle } =
    useFocusExtras({
      running,
      mode,
      atmosphere: paintedAtmosphere,
      isPro: auth.isPro,
      onFocusTab: tab === 'focus',
      toggle,
    });
  const focusEstimate = selectedTask
    ? estimateVsActual(selectedTask.estimateMin, getMinutesForTask(selectedTask.id, history))
    : null;

  /* ---------- Mono Focus + Azi: one daily spine (Ivy plan) ---------- */
  const todayKey = dayKeyInTz(Date.now(), auth.timezone);
  const todayPlan = planForDay(ivyPlans, todayKey);
  const planTaskIds = useMemo(
    () => new Set((todayPlan?.tasks ?? []).map((x) => x.taskId).filter((id): id is string => !!id)),
    [todayPlan],
  );
  const todayMaxTasks = auth.isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const nextPlanItem = todayPlan?.tasks.find((x) => !x.done) ?? null;

  // Keep the intention on the top unfinished plan item unless the user typed
  // something else (or cleared it intentionally after we auto-filled).
  const nextPlanItemId = nextPlanItem?.id ?? null;
  const nextPlanItemText = nextPlanItem?.text ?? null;
  useEffect(() => {
    if (!nextPlanItemId || nextPlanItemText == null) return;
    setIntentionDraft((prev) => {
      const trimmed = prev.trim();
      if (trimmed === '' || prev === autoIntentionRef.current) {
        autoIntentionRef.current = nextPlanItemText;
        return nextPlanItemText;
      }
      return prev;
    });
  }, [nextPlanItemId, nextPlanItemText]);

  const lastWeekRecap = useMemo(
    () =>
      buildLastWeekRecap({
        history,
        tasks,
        habitLog,
        phases,
        projects,
        timezone: auth.timezone,
        todayKey,
      }),
    [history, tasks, habitLog, phases, projects, auth.timezone, todayKey],
  );
  const [recapSeen, setRecapSeen] = useState<string | null>(loadRecapSeen);
  const showRecap = shouldShowRecap({
    todayKey,
    seenMonday: recapSeen,
    recap: lastWeekRecap,
    firstRun: showOnboarding,
  });
  const dismissRecap = () => {
    const monday = mondayOf(todayKey);
    saveRecapSeen(monday);
    setRecapSeen(monday);
  };

  const todayProgress = dayProgress(todayPlan, history, todayKey, auth.timezone);
  const focusStats = {
    sessions: history.filter((s) => isTodayInTz(s.at, auth.timezone)).length,
    focusMin: todayProgress.focusMin,
    done: todayProgress.done,
  };
  const focusUpNext = (todayPlan?.tasks ?? []).map((x) => ({
    id: x.id,
    title: x.text,
    meta: typeof x.estimateMin === 'number' ? fmtDur(x.estimateMin) : '',
    done: x.done,
  }));
  const focusTaskOptions = (
    selectedProjectId ? tasks.filter((x) => x.projectId === selectedProjectId) : []
  ).map((x) => ({ id: x.id, title: x.title }));

  // Picking a length saves it with its paired breaks (25 → 5 / 15), so the
  // whole focus → break → long-break cycle follows the chosen rhythm.
  const handlePreset = (min: number) => {
    if (running) return;
    updateSettings(rhythmFor(min));
    setRoundLength(min);
  };
  const handleToggleTask = (id: string) => {
    const r = togglePlanItem(ivyPlans, todayKey, id, tasks);
    if (r.plans !== ivyPlans) setIvyPlans(r.plans);
    if (r.tasks !== tasks) setTasks(r.tasks);
  };

  // Projects/Focus → today's plan: linked items follow their task's status.
  useEffect(() => {
    const synced = syncPlanWithTasks(ivyPlans, todayKey, tasks);
    if (synced) setIvyPlans(synced);
  }, [tasks, ivyPlans, todayKey, setIvyPlans]);
  const addLinkedTaskToPlan = (task: Task): boolean => {
    if (dayPlanHasLinkedTask(ivyPlans, todayKey, task.id)) return false;
    const r = addTaskToDay(
      ivyPlans,
      todayKey,
      task.title,
      todayMaxTasks,
      typeof task.estimateMin === 'number' ? task.estimateMin : undefined,
      task.id,
    );
    if (r.added) setIvyPlans(r.plans);
    return r.added;
  };

  useWelcomeEmail(auth.status === 'authenticated' ? (auth.user?.userId ?? null) : null, locale);

  /* ---------- quick capture: inbox, toast, morning triage ---------- */
  const { toast, setToast } = useAppToast({
    t,
    onOpenSettings: () => goNav('settings'),
    hasLocalWork: history.length > 0 || tasks.length > 0,
  });

  const handleQuickAdd = (text: string): boolean => {
    const q = parseQuickAdd(text, locale, Date.now());
    if (!hasQuickTokens(q)) {
      const r = addTaskToDay(ivyPlans, todayKey, text.trim(), todayMaxTasks);
      if (r.added) {
        setIvyPlans(r.plans);
        return true;
      }
      const task = createInboxTask(q);
      if (!task) return false;
      setTasks([...tasks, task]);
      setToast({ message: t('mono.qa.planFull') });
      return true;
    }
    const task = createInboxTask(q);
    if (!task) return false;
    setTasks([...tasks, task]);
    const dueKey = q.dueAt === null ? todayKey : dayKeyInTz(q.dueAt, auth.timezone);
    if (dueKey === todayKey) {
      const r = addTaskToDay(
        ivyPlans,
        todayKey,
        task.title,
        todayMaxTasks,
        task.estimateMin,
        task.id,
      );
      if (r.added) setIvyPlans(r.plans);
      else setToast({ message: t('mono.qa.planFull') });
      return true;
    }
    const day = dueKey === addDays(todayKey, 1) ? t('mono.qa.tomorrow') : fmtDayKey(dueKey);
    const date =
      q.hasTime && q.dueAt !== null
        ? t('mono.qa.at', {
            date: day,
            time: fmtClock(new Date(q.dueAt).getHours() * 60 + new Date(q.dueAt).getMinutes()),
          })
        : day;
    setToast({ message: t('mono.qa.savedFor', { date }) });
    return true;
  };

  const inboxList = inboxTasks(tasks).filter(
    (x) => !dayPlanHasLinkedTask(ivyPlans, todayKey, x.id),
  );
  const dropTasks = (id: string) => {
    const after = removeTask(tasks, id);
    const kept = new Set(after.map((x) => x.id));
    const removed = tasks.filter((x) => !kept.has(x.id));
    setTasks(after);
    return () => {
      setTasks((prev) => {
        const have = new Set(prev.map((x) => x.id));
        return [...prev, ...removed.filter((x) => !have.has(x.id))];
      });
    };
  };
  const handleInboxDelete = (id: string) => {
    const undo = dropTasks(id);
    setToast({
      message: t('mono.inbox.deleted'),
      action: {
        label: t('mono.inbox.undo'),
        onClick: () => {
          undo();
          setToast(null);
        },
      },
    });
  };
  const handleInboxToday = (id: string) => {
    const task = tasks.find((x) => x.id === id);
    if (!task) return;
    if (!addLinkedTaskToPlan(task)) setToast({ message: t('mono.triage.full') });
  };

  const triageCtx = { todayKey, maxTasks: todayMaxTasks, now: Date.now() };
  const lastTriageDrop = useRef<{ tasks: Task[]; plans: typeof ivyPlans } | null>(null);
  const handleTriage = (s: Suggestion, action: TriageAction) => {
    const r = applyTriage({ tasks, plans: ivyPlans }, s, action, triageCtx);
    if (r.ok && action === 'drop') lastTriageDrop.current = { tasks, plans: ivyPlans };
    if (r.tasks !== tasks) setTasks(r.tasks);
    if (r.plans !== ivyPlans) setIvyPlans(r.plans);
    return r.reason ? { ok: r.ok, reason: r.reason } : { ok: r.ok };
  };
  // Undo is offered only right after a drop, so restoring the snapshot is safe.
  const handleTriageUndo = () => {
    const snap = lastTriageDrop.current;
    if (!snap) return;
    setTasks(snap.tasks);
    setIvyPlans(snap.plans);
    lastTriageDrop.current = null;
  };
  const handleSnooze = (planItemId: string) => {
    const r = snoozeToTomorrow({ tasks, plans: ivyPlans }, planItemId, triageCtx);
    if (r.plans === ivyPlans) return;
    setTasks(r.tasks);
    setIvyPlans(r.plans);
    setToast({ message: t('mono.azi.snoozed') });
  };

  const handleRemoveFromToday = (planItemId: string) => {
    const before = ivyPlans;
    const next = removePlanTask(before, todayKey, planItemId);
    if (next === before) return;
    setIvyPlans(next);
    setToast({
      message: t('mono.azi.removed'),
      action: { label: t('mono.azi.undo'), onClick: () => setIvyPlans(before) },
    });
  };

  const canCreateProject = auth.isPro || projects.length < FREE_PROJECTS_LIMIT;
  const handleLifeTemplate = (id: LifeTemplateId) => {
    const tpl = getLifeTemplate(id);
    if (!tpl || !isTemplateAvailable(id, auth.isPro) || !canCreateProject) return;
    const r = instantiateLifeTemplate(tpl, {
      t,
      now: Date.now(),
      isPro: auth.isPro,
      existingActiveHabits: habits.filter((h) => !h.archived).length,
    });
    setProjects([...projects, r.project]);
    setTasks([...tasks, ...r.tasks]);
    if (r.habits.length > 0) setHabits([...habits, ...r.habits]);
    handleSelectProject(r.project.id);
    const created = t('goal.tpl.created', { name: r.project.name });
    setToast(
      r.skippedHabits > 0
        ? {
            message: `${created} ${appI18n.tp('goal.tpl.habitsSkipped', r.skippedHabits)}`,
            action: { label: t('proj.upgrade'), onClick: () => navigate('/pricing') },
          }
        : { message: created },
    );
  };

  const nowMs = Date.now();
  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const nextBlock = nextFocusBlock(
    timeBlocks,
    weekdayOfKey(todayKey),
    minuteOfDayInTz(nowMs, auth.timezone),
  );
  const frogPick = pickFrog(tasks, projects, nowMs);
  const frogDayKey = localDayKey(nowMs);
  // Lives here, not in FrogCard, so the streak still records while "More today" is collapsed.
  useEffect(() => {
    if (!frogPick) return;
    const entry = frogLog[frogDayKey];
    const done = frogPick.status === 'completed' || entry?.done === true;
    if (!entry || entry.taskId !== frogPick.id || entry.done !== done) {
      const next = recordFrog(frogLog, frogDayKey, frogPick.id, done);
      saveFrogLog(next);
      setFrogLog(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frogPick?.id, frogPick?.status, frogDayKey]);
  const dayMotto = mottoForDay(todayKey, locale);
  const lifeHub = buildLifeHubSnapshot({
    plan: todayPlan,
    focusSessions: focusStats.sessions,
    focusMin: focusStats.focusMin,
    tasks,
    projects,
    lifeMap,
  });

  // Progressive disclosure (Roadmap Faza 2): brand-new workspaces see only
  // the calm core flow; everything else unfolds after first sessions.
  const engaged = isEngagedUser(history, projects);
  const [todayMoreOpen, setTodayMoreOpen] = useState<boolean | null>(null);
  const moreIsOpen = todayMoreOpen ?? false;
  const openTodayHabitsManage = () => {
    setTodayMoreOpen(true);
    queueMicrotask(() => {
      document.getElementById('today-life-habits')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

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

  if (!isKnownClientRoute(pathname)) {
    return (
      <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
        <MonoNotFound />
      </LocaleProvider>
    );
  }

  return (
    <Routes>
      {LEGAL_DOCS.map((doc) => (
        <Route
          key={doc}
          path={LEGAL_PATHS[doc]}
          element={
            <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
              <Suspense fallback={null}>
                <LegalPage doc={doc} />
              </Suspense>
            </LocaleProvider>
          }
        />
      ))}
      <Route
        path="/help"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <HelpPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/pricing"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <PricingPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/login"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <LoginPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/reset-password"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <ResetPasswordPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/account"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <CabinetPage />
          </LocaleProvider>
        }
      />
      <Route
        path="/account/calendar-callback"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <CalendarCallback />
          </LocaleProvider>
        }
      />
      <Route
        path="*"
        element={
          <LocaleProvider locale={locale} dictionary={i18nDict} onLocaleChange={changeLocale}>
            <div
              ref={modeWrapRef}
              data-mode={mode}
              data-focusing={running}
              data-atmosphere={paintedAtmosphere}
              className="atm-root relative min-h-screen overflow-hidden"
            >
              <p role="status" aria-live="polite" className="sr-only">
                {announce}
              </p>

              <MonoNav
                tab={tab}
                onTab={goNav}
                onNewSession={() => goNav('focus')}
                onOpenPalette={() => setPaletteOpen(true)}
              />
              <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onTab={goNav}
                tasks={tasks}
                projects={projects}
                goals={goals}
                running={running}
                onToggleTimer={toggle}
                onSelectProject={(id) => {
                  handleSelectProject(id);
                  goNav('focus');
                }}
                onSelectTask={(id, projectId) => {
                  if (!projectId) {
                    goNav('projects');
                    return;
                  }
                  handleSelectProject(projectId);
                  handleSelectTask(id);
                  goNav('focus');
                }}
                onQuickAdd={handleQuickAdd}
              />
              <div className="mono mono-shell">
                <div
                  id="mono-tabpanel"
                  role="tabpanel"
                  aria-label={t(
                    MONO_NAV_ITEMS.find((item) => item.id === tab)?.label ?? 'mono.nav.more',
                  )}
                  className="mono-shell-inner"
                >
                  {returnTo && returnTo !== tab ? (
                    <MonoReturn to={returnTo} onBack={goBack} />
                  ) : null}
                  {tab === 'focus' && (
                    <main>
                      <MonoFocus
                        mode={mode}
                        running={running}
                        remaining={remaining}
                        total={total}
                        focusMin={mode === 'focus' ? total / 60 : settings.focusMin}
                        shortMin={settings.shortMin}
                        longMin={settings.longMin}
                        longEvery={settings.longEvery}
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
                        onToggle={handleFocusToggle}
                        onReset={reset}
                        onPreset={handlePreset}
                        onToggleTask={handleToggleTask}
                        onSeePlan={() => goFill('today')}
                        onPath={goFill}
                        dayKey={todayKey}
                        planTaskCount={todayPlan?.tasks.length ?? 0}
                        planOpenCount={todayPlan?.tasks.filter((x) => !x.done).length ?? 0}
                        atmosphere={paintedAtmosphere}
                        ambient={{
                          on: focusPrefs.ambientOn,
                          layers: ambient.layers,
                          isPro: auth.isPro,
                          onToggle: () => {
                            ambient.prime();
                            updateFocusPrefs({ ambientOn: !focusPrefs.ambientOn });
                          },
                          onChange: (layers: AmbientLayer[]) => {
                            ambient.prime();
                            updateFocusPrefs({
                              ambient: layers.length > 0 ? layers : null,
                              ambientOn: layers.length > 0,
                            });
                          },
                          wakeLock: focusPrefs.wakeLock,
                          onWakeLock: (on: boolean) => updateFocusPrefs({ wakeLock: on }),
                        }}
                        fullscreen={{
                          active: zen.active,
                          supported: zen.supported,
                          onToggle: zen.toggle,
                          rootRef: focusRootRef,
                        }}
                        estimate={focusEstimate}
                      />
                      {activeRm ? (
                        <div className="mono-pad" style={{ marginTop: 14 }}>
                          <MonoRoadmapStrip
                            roadmap={activeRm}
                            onOpen={() => goNav('plan')}
                            onWorkFocus={handleWorkFocus}
                          />
                        </div>
                      ) : null}
                      {showGettingStarted && (
                        <div className="mono-pad atm-desk-below">
                          <GettingStarted onGo={goFill} />
                        </div>
                      )}
                    </main>
                  )}
                  {tab === 'today' && (
                    <main>
                      <MonoAzi
                        dayKey={todayKey}
                        doneCount={todayProgress.done}
                        totalCount={todayProgress.total}
                        focusMinToday={todayProgress.focusMin}
                        items={(todayPlan?.tasks ?? []).map((x) => {
                          const linked = x.taskId ? taskById.get(x.taskId) : undefined;
                          const due = linked ? dueStatus(linked.dueAt, nowMs, auth.timezone) : null;
                          const est = x.estimateMin ?? linked?.estimateMin;
                          const actual = linked ? getMinutesForTask(linked.id, history) : 0;
                          return {
                            id: x.id,
                            text: x.text,
                            meta:
                              typeof est === 'number' && actual > 0
                                ? t('mono.azi.estMeta', { act: fmtDur(actual), est: fmtDur(est) })
                                : typeof x.estimateMin === 'number'
                                  ? fmtDur(x.estimateMin)
                                  : '',
                            done: x.done,
                            priority: linked?.priority,
                            due,
                            snooze:
                              x.carried === true ||
                              due?.kind === 'overdue' ||
                              due?.kind === 'today',
                            icon: linked?.icon,
                          };
                        })}
                        onSnooze={handleSnooze}
                        onRemove={handleRemoveFromToday}
                        maxTasks={todayMaxTasks}
                        morningLabel={t('today.morning')}
                        shutdownLabel={t('today.shutdown')}
                        onMorning={() => setMorningOpen(true)}
                        onShutdown={() => setShutdownOpen(true)}
                        onToggle={handleToggleTask}
                        onAdd={handleQuickAdd}
                        onGoWork={() => goFill('focus')}
                        onPath={goFill}
                        motto={{ text: dayMotto.text, source: dayMotto.source }}
                        banner={
                          timeOff.includes(todayKey) ? (
                            <MonoVacationBanner
                              timeOff={timeOff}
                              onChange={setTimeOff}
                              todayKey={todayKey}
                            />
                          ) : undefined
                        }
                        recap={
                          showRecap ? (
                            <MonoWeekRecap
                              recap={lastWeekRecap}
                              onDismiss={dismissRecap}
                              onOpenReports={() => goNav('reports')}
                            />
                          ) : undefined
                        }
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
                          nextBlock ? (
                            <button
                              type="button"
                              className="mono-card"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                cursor: 'pointer',
                                border: 'none',
                              }}
                              onClick={() => goFill('orar')}
                            >
                              <div className="mono-h3">
                                {t(
                                  nextBlock.state === 'now'
                                    ? 'mono.azi.blockNow'
                                    : 'mono.azi.blockNext',
                                  {
                                    start: fmtClock(nextBlock.block.startMin),
                                    end: fmtClock(nextBlock.block.endMin),
                                  },
                                )}
                              </div>
                              <p className="mono-meta" style={{ marginTop: 4 }}>
                                {t('mono.azi.blockHint')}
                              </p>
                            </button>
                          ) : undefined
                        }
                        habits={
                          <MonoHabitsCheckin
                            habits={habits}
                            habitLog={habitLog}
                            onHabitLogChange={setHabitLog}
                            onManage={openTodayHabitsManage}
                            timeOff={timeOff}
                          />
                        }
                        move={
                          isMoving(workoutStore, nowMs) ? (
                            <MonoMoveToday
                              store={workoutStore}
                              dayKey={frogDayKey}
                              now={nowMs}
                              onStart={startWorkoutFromToday}
                              onOpen={() => goFill('move')}
                            />
                          ) : undefined
                        }
                        checkin={
                          <MonoCheckin
                            entries={energyLog}
                            onChange={setEnergyLog}
                            timezone={auth.timezone}
                          />
                        }
                        more={
                          <>
                            <div className="mono-sec">
                              <Disclosure
                                title={t('today.more')}
                                hint={t('today.moreHint')}
                                defaultOpen={false}
                                open={moreIsOpen}
                                onOpenChange={setTodayMoreOpen}
                              >
                                {!showGettingStarted && (
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
                                    planTaskIds={planTaskIds}
                                  />
                                )}
                                <FrogCard
                                  tasks={tasks}
                                  projects={projects}
                                  frogLog={frogLog}
                                  frogLogChange={setFrogLog}
                                  onTasksChange={setTasks}
                                  isPro={auth.isPro}
                                  onPlan={
                                    frogPick
                                      ? dayPlanHasLinkedTask(ivyPlans, todayKey, frogPick.id)
                                      : false
                                  }
                                  onAddToPlan={
                                    frogPick
                                      ? () => {
                                          addLinkedTaskToPlan(frogPick);
                                        }
                                      : undefined
                                  }
                                />
                                <MatrixCard
                                  tasks={tasks}
                                  history={history}
                                  onTasksChange={setTasks}
                                  isPro={auth.isPro}
                                  planTaskIds={planTaskIds}
                                  onAddToPlan={addLinkedTaskToPlan}
                                />
                                <div id="today-life-habits">
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
                            </div>
                          </>
                        }
                      />
                      {activeRm ? (
                        <div className="mono-pad" style={{ marginTop: 14 }}>
                          <MonoRoadmapStrip
                            roadmap={activeRm}
                            onOpen={() => goNav('plan')}
                            onWorkFocus={handleWorkFocus}
                          />
                        </div>
                      ) : null}
                    </main>
                  )}
                  {tab === 'orar' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoOrar
                          timezone={auth.timezone}
                          onPath={goFill}
                          dayKey={todayKey}
                          hasBlocks={timeBlocks.length > 0}
                        >
                          <div style={{ marginBottom: 18 }}>
                            <MonoWeek
                              plans={ivyPlans}
                              tasks={tasks}
                              history={history}
                              habits={habits}
                              habitLog={habitLog}
                              energyLog={energyLog}
                              timezone={auth.timezone}
                              onOpenToday={() => goNav('today')}
                              moveFor={moveForDay}
                            />
                          </div>
                          <CalendarCard
                            history={history}
                            projects={projects}
                            timezone={auth.timezone}
                            isPro={auth.isPro}
                            blocks={timeBlocks}
                            blocksChange={setTimeBlocks}
                            externalEvents={externalCalendarEvents}
                          />
                        </MonoOrar>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'plan' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoHead title={t('nav.plan')} sub={t('nav.hint.plan')} />
                        <div className="mono-pad mt-2 grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 md:gap-6">
                          <div
                            className="reveal flex min-h-0 flex-col"
                            style={{ animationDelay: '90ms' }}
                          >
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
                              skills={skills}
                              objectives={objectives}
                              links={links}
                              onLinksChange={setLinks}
                              isPro={auth.isPro}
                              onWorkFocus={handleWorkFocus}
                            />
                          </div>
                          <div
                            className="reveal flex min-h-0 flex-col"
                            style={{ animationDelay: '130ms' }}
                          >
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
                              onProjectsChange={setProjects}
                              phases={phases}
                              onPhasesChange={setPhases}
                              roadmaps={roadmaps}
                              onRoadmapsChange={setRoadmaps}
                              onWorkFocus={handleWorkFocus}
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
                              goals={goals}
                              goalsChange={setGoals}
                              phases={phases}
                              phasesChange={setPhases}
                              timezone={auth.timezone}
                              isPro={auth.isPro}
                            />
                          </div>
                          <Disclosure
                            title={t('today.advPlan')}
                            hint={t('today.advSkillsHint')}
                            defaultOpen={engaged}
                          >
                            <div
                              className="reveal h-full min-w-0"
                              style={{ animationDelay: '170ms' }}
                            >
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
                            <div
                              className="reveal h-full min-w-0"
                              style={{ animationDelay: '210ms' }}
                            >
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
                                links={links}
                                onLinksChange={setLinks}
                                goals={goals}
                                projects={projects}
                                objectives={objectives}
                                isPro={auth.isPro}
                              />
                            </div>
                          </Disclosure>
                        </div>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'growth' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoCrestere>
                          <div
                            className="reveal mono-growth-span"
                            style={{ animationDelay: '60ms' }}
                          >
                            <MonoRankCard xp={xp} badges={badges} isPro={auth.isPro} />
                          </div>
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
                          <div
                            className="reveal mono-growth-span"
                            style={{ animationDelay: '170ms' }}
                          >
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
                  {tab === 'move' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoMiscare
                          store={workoutStore}
                          habits={habits}
                          isPro={auth.isPro}
                          onSave={handleWorkoutSave}
                          onDelete={(id) => commitWorkouts(deleteWorkout(workoutStore, id))}
                          onChange={commitWorkouts}
                          onAddGoal={addExerciseGoal}
                        />
                      </main>
                    </Suspense>
                  )}
                  {tab === 'map' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoViata
                          motto={dayMotto}
                          frames={lifeHub.frames}
                          next={lifeHub.next}
                          onGo={goFill}
                        >
                          {lifeMapCard}
                        </MonoViata>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'projects' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoProiecte activeCount={projects.filter((p) => !p.archived).length}>
                          <MonoInbox
                            tasks={inboxList}
                            projects={projects}
                            onToday={handleInboxToday}
                            onAssign={(id, projectId) =>
                              setTasks(assignProject(tasks, id, projectId))
                            }
                            onDelete={handleInboxDelete}
                          />
                          <MonoTemplates
                            isPro={auth.isPro}
                            canCreate={canCreateProject}
                            hasProjects={projects.length > 0}
                            onCreate={handleLifeTemplate}
                          />
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
                            onWorkFocus={handleWorkFocus}
                            phases={phases}
                            onPhasesChange={setPhases}
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
                                onWorkFocus={handleWorkFocus}
                              />
                            </Disclosure>
                          </div>
                        </MonoProiecte>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'reports' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoRapoarte>
                          {history.length === 0 && habits.length === 0 ? (
                            <div className="reveal mono-card" style={{ animationDelay: '40ms' }}>
                              <MonoEmpty
                                art={<MonoArt name="chart" />}
                                title={t('rep.empty.title')}
                                body={t('rep.empty.body')}
                                action={
                                  <MonoBtn type="button" onClick={() => goNav('focus')}>
                                    {t('rep.empty.cta')}
                                  </MonoBtn>
                                }
                              />
                            </div>
                          ) : (
                            <>
                              <div className="reveal" style={{ animationDelay: '40ms' }}>
                                <MonoReportInsights
                                  habits={habits}
                                  habitLog={habitLog}
                                  history={history}
                                  energyLog={energyLog}
                                  timezone={auth.timezone}
                                  isPro={auth.isPro}
                                  tasks={tasks}
                                />
                              </div>
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
                                  goals={goals}
                                  skills={skills}
                                  timezone={auth.timezone}
                                  capacityMin={settings.weeklyCapacityMin}
                                  isPro={auth.isPro}
                                />
                              </div>
                            </>
                          )}
                        </MonoRapoarte>
                      </main>
                    </Suspense>
                  )}
                  {tab === 'graph' && (
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoHead title={t('graph.title')} sub={t('graph.headSub')} />
                        <div className="mono-pad mt-2 reveal" style={{ animationDelay: '90ms' }}>
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
                    <Suspense fallback={<TabFallback />}>
                      <main>
                        <MonoHead title={t('mono.nav.settings')} sub={t('nav.settingsTitle')} />
                        <div className="mono-pad mt-2 reveal" style={{ animationDelay: '90ms' }}>
                          <MonoSettings
                            settings={settings}
                            onChange={updateSettings}
                            theme={theme}
                            onThemeChange={setTheme}
                            isPro={auth.isPro}
                            atmosphere={atmosphere}
                            onAtmosphere={setAtmosphere}
                            synced={auth.status === 'authenticated' && syncState.initialized}
                            signedIn={auth.status === 'authenticated'}
                            user={auth.user}
                          />
                        </div>
                      </main>
                    </Suspense>
                  )}

                  {tab === 'more' && (
                    <main className="mt-4">
                      <div className="reveal" style={{ animationDelay: '90ms' }}>
                        <MonoMore tab={tab} onOpen={goNav} />
                      </div>
                    </main>
                  )}
                </div>
              </div>

              {morningOpen && !showOnboarding && (
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
                  triage={buildSuggestions({
                    tasks,
                    plans: ivyPlans,
                    todayKey,
                    timezone: auth.timezone,
                  })}
                  onTriage={handleTriage}
                  onTriageUndo={handleTriageUndo}
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
              {reflectionSession && (
                <PostSessionReflection
                  session={reflectionSession}
                  journal={journal}
                  journalChange={setJournal}
                  timezone={auth.timezone}
                  onDone={() => setReflectionSession(null)}
                />
              )}
              {moments.current && (
                <Suspense fallback={null}>
                  <MonoCelebrate moment={moments.current} onDone={moments.dismiss} />
                </Suspense>
              )}
              <MonoToast message={toast?.message ?? null} action={toast?.action ?? null} />
            </div>
          </LocaleProvider>
        }
      />
    </Routes>
  );
}
