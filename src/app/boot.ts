/**
 * App boot: advance the local storage schema, then read every local store once
 * and restore the timer (resuming a round that was running when the app closed).
 * Pure function of what is in this browser's storage — no React, testable.
 */

import { loadRoadmaps } from '../lib/ai/roadmap';
import { loadChatHistory } from '../lib/assistant';
import { loadEnergyLog } from '../lib/energy';
import { loadLinks } from '../lib/entityLinks';
import { armRoundFocus, loadFocusAreas, loadSelectedArea } from '../lib/focusAreas';
import { loadFrogLog } from '../lib/frog';
import { loadGoals } from '../lib/goals';
import { loadHabitLog, loadHabits } from '../lib/habits';
import { loadIntentionDraft } from '../lib/intentions';
import { loadPlans } from '../lib/ivyLee';
import { loadJournal, loadTimeOff } from '../lib/journal';
import { loadLifeAreas } from '../lib/lifeAreas';
import { loadLifeMap } from '../lib/lifemap';
import { loadObjectives } from '../lib/okrs';
import { loadProjects, loadSelectedProject } from '../lib/projects';
import { loadSavedFilters } from '../lib/savedFilters';
import { loadSkills } from '../lib/skills';
import { loadSprints } from '../lib/sprints';
import { runLocalMigrations } from '../lib/storage/migrations';
import { type Mode, durationFor, loadHistory, loadSettings, loadSnapshot } from '../lib/store';
import { loadTasks } from '../lib/tasks';
import { loadBlocks } from '../lib/timeBlocks';
import { resumeState } from '../lib/timerEngine';
import { loadPhases } from '../lib/waterfall';

export function loadBoot() {
  // Advance the local storage schema before any data load (idempotent).
  runLocalMigrations();
  const settings = loadSettings();
  const snap = loadSnapshot();
  const mode: Mode = snap?.mode ?? 'focus';
  const total = snap?.mode === mode ? snap.total : durationFor(mode, settings);
  // A round that was running when the tab closed resumes at its real end time
  // (or is credited at once if it finished while the app was closed).
  const resume = snap ? resumeState(snap, Date.now()) : null;
  const remaining = resume ? Math.min(resume.remaining, total) : total;
  const resumedRound = resume?.endsAt && snap?.round ? snap.round : null;
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
  const roadmaps = loadRoadmaps();
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
    endsAt: resume?.endsAt ?? null,
    roundMin: resumedRound?.min ?? (mode === 'focus' ? settings.focusMin : 0),
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
    roadmaps,
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
    roundIntention: resumedRound ? resumedRound.intention : roundMeta.intention,
    roundAreaId: resumedRound ? resumedRound.areaId : roundMeta.areaId,
    roundProjectId: resumedRound
      ? resumedRound.projectId
      : mode === 'focus'
        ? selectedProjectId
        : null,
    roundTaskId: resumedRound ? resumedRound.taskId : null,
  };
}

export type BootState = ReturnType<typeof loadBoot>;
