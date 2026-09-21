import { useEffect } from 'react';
import { saveSettings, saveHistory, type Session, type Settings } from '../lib/store';
import { saveIntentionDraft } from '../lib/intentions';
import { saveFocusAreas, type FocusArea } from '../lib/focusAreas';
import { saveProjects, type Project } from '../lib/projects';
import { saveTasks, type Task } from '../lib/tasks';
import { savePlans, type IvyPlan } from '../lib/ivyLee';
import { saveBlocks, type TimeBlock } from '../lib/timeBlocks';
import { saveSkills, type Skill } from '../lib/skills';
import { saveFrogLog, type FrogLog } from '../lib/frog';
import { saveGoals, type Goal } from '../lib/goals';
import { saveChatHistory, type ChatMessage } from '../lib/assistant';
import { saveHabits, saveHabitLog, type Habit, type HabitLog } from '../lib/habits';
import { saveLifeAreas, type LifeArea } from '../lib/lifeAreas';
import { saveLifeMap, type LifeMapArea } from '../lib/lifemap';
import { saveJournal, saveTimeOff, type Journal } from '../lib/journal';
import { saveEnergyLog, type EnergyEntry } from '../lib/energy';
import { saveSprints, type Sprint } from '../lib/sprints';
import { saveObjectives, type Objective } from '../lib/okrs';
import { savePhases, type WaterfallPhase } from '../lib/waterfall';
import { saveTheme, type UITheme } from '../lib/theme';
import { saveLinks, type EntityLink } from '../lib/entityLinks';
import { saveSavedFilters, type SavedFilter } from '../lib/savedFilters';

/**
 * Local persistence boundary (Roadmap Faza 1.2).
 *
 * One effect per store slice, moved verbatim from App — behavior is
 * unchanged; only the address moved so the component stays readable.
 */
export interface PersistedState {
  settings: Settings;
  history: Session[];
  intentionDraft: string;
  areas: FocusArea[];
  projects: Project[];
  tasks: Task[];
  ivyPlans: IvyPlan[];
  timeBlocks: TimeBlock[];
  skills: Skill[];
  frogLog: FrogLog;
  goals: Goal[];
  chatHistory: ChatMessage[];
  habits: Habit[];
  habitLog: HabitLog;
  lifeAreas: LifeArea[];
  lifeMap: LifeMapArea[];
  journal: Journal;
  timeOff: string[];
  energyLog: EnergyEntry[];
  sprints: Sprint[];
  objectives: Objective[];
  phases: WaterfallPhase[];
  theme: UITheme;
  links: EntityLink[];
  savedFilters: SavedFilter[];
}

export function useAppPersistence(s: PersistedState): void {
  const {
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
  } = s;

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
    saveLifeMap(lifeMap);
  }, [lifeMap]);
  useEffect(() => {
    saveJournal(journal);
  }, [journal]);
  useEffect(() => {
    saveTimeOff(timeOff);
  }, [timeOff]);
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
  useEffect(() => {
    saveLinks(links);
  }, [links]);
  useEffect(() => {
    saveSavedFilters(savedFilters);
  }, [savedFilters]);
}
