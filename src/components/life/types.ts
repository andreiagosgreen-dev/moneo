import type { Habit } from '../../lib/habits';
import type { HabitLog } from '../../lib/habits';
import type { LifeArea } from '../../lib/lifeAreas';
import type { FocusArea } from '../../lib/focusAreas';
import type { Journal } from '../../lib/journal';
import type { FrogLog } from '../../lib/frog';
import type { EnergyEntry } from '../../lib/energy';
import type { Goal } from '../../lib/goals';
import type { Project } from '../../lib/projects';
import type { Skill } from '../../lib/skills';
import type { Session } from '../../lib/store';
import type { TKey } from '../../lib/i18n/types';
import type { EntityLink } from '../../lib/entityLinks';
import type { Objective } from '../../lib/okrs';

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
  projects: Project[];
  skills: Skill[];
  objectives: Objective[];
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  history: Session[];
  timezone: string;
  isPro?: boolean;
}

export type LifeTab = 'habits' | 'balance' | 'journal' | 'energy';

export const LIFE_TABS: Array<{ id: LifeTab; label: TKey }> = [
  { id: 'habits', label: 'life.tab.habits' },
  { id: 'balance', label: 'life.tab.balance' },
  { id: 'journal', label: 'life.tab.journal' },
  { id: 'energy', label: 'life.tab.energy' },
];
