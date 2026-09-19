import type { Habit } from '../../lib/habits';
import type { HabitLog } from '../../lib/habits';
import type { LifeArea } from '../../lib/lifeAreas';
import type { FocusArea } from '../../lib/focusAreas';
import type { Journal } from '../../lib/journal';
import type { FrogLog } from '../../lib/frog';
import type { EnergyEntry } from '../../lib/energy';
import type { Goal } from '../../lib/goals';
import type { Session } from '../../lib/store';

export interface LifeCardProps {
  habits: Habit[];
  habitsChange: (habits: Habit[]) => void;
  habitLog: HabitLog;
  habitLogChange: (log: HabitLog) => void;
  lifeAreas: LifeArea[];
  lifeAreasChange: (areas: LifeArea[]) => void;
  focusAreas: FocusArea[];
  journal: Journal;
  journalChange: (journal: Journal) => void;
  timeOff: string[];
  timeOffChange: (days: string[]) => void;
  frogLog: FrogLog;
  energyLog: EnergyEntry[];
  energyLogChange: (entries: EnergyEntry[]) => void;
  goals: Goal[];
  history: Session[];
  timezone: string;
  isPro?: boolean;
}

export type LifeTab = 'habits' | 'balance' | 'journal' | 'energy';

export const LIFE_TABS: Array<{ id: LifeTab; label: string }> = [
  { id: 'habits', label: 'Habits' },
  { id: 'balance', label: 'Balance' },
  { id: 'journal', label: 'Journal' },
  { id: 'energy', label: 'Energy' },
];
