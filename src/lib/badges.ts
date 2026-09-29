/* Badges — derived from the same local data as XP (see ./xp), never stored.
 * Each badge is a pure function of that data, so it can't drift: unchecking
 * a task can take one back, and a sync pull or restore brings them along.
 */
import { localDayKey } from './projects';
import {
  RANKS,
  type RankId,
  type XpInput,
  computeXp,
  finishedProjectIds,
  levelFromXp,
  xpAtLevel,
} from './xp';

export type BadgeId =
  | 'firstFocus'
  | 'focus10h'
  | 'streak7'
  | 'firstProject'
  | 'tasks50'
  | 'apprentice'
  | 'practitioner'
  | 'expert';

export interface Badge {
  id: BadgeId;
  earned: boolean;
  /** Where the user stands towards a locked badge (value never exceeds target). */
  progress?: { value: number; target: number };
}

export interface BadgeInput extends XpInput {
  /** Pre-computed total XP; recomputed from the input when omitted. */
  totalXp?: number;
}

export const BADGE_RULES = {
  focusHours: 10,
  focusStreakDays: 7,
  tasksDone: 50,
} as const;

function rankLevel(id: RankId): number {
  return RANKS.find((r) => r.id === id)?.firstLevel ?? 1;
}

function validSession(s: XpInput['history'][number] | undefined): boolean {
  return (
    !!s && typeof s.at === 'number' && Number.isFinite(s.at) && Number.isFinite(s.min) && s.min > 0
  );
}

/** Longest run of consecutive local days with at least one focus round. */
export function longestFocusStreak(history: XpInput['history']): number {
  const days = new Set<string>();
  for (const s of history) if (validSession(s)) days.add(localDayKey(s.at));
  let best = 0;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    if (days.has(localDayKey(new Date(y, m - 1, d - 1).getTime()))) continue;
    let run = 1;
    while (days.has(localDayKey(new Date(y, m - 1, d + run).getTime()))) run++;
    best = Math.max(best, run);
  }
  return best;
}

function counter(id: BadgeId, value: number, target: number): Badge {
  const v = Math.max(0, Math.floor(value));
  return { id, earned: v >= target, progress: { value: Math.min(v, target), target } };
}

export function computeBadges(input: BadgeInput): Badge[] {
  const history = (input.history ?? []).filter(validSession);
  const tasks = input.tasks ?? [];
  const focusMin = history.reduce((sum, s) => sum + Math.floor(s.min), 0);
  const tasksDone = tasks.filter((t) => t && t.status === 'completed').length;
  const projectsDone = finishedProjectIds(input.projects ?? [], tasks, input.phases ?? []).length;
  const total =
    typeof input.totalXp === 'number' && Number.isFinite(input.totalXp)
      ? input.totalXp
      : computeXp(input).total;
  const level = levelFromXp(total).level;
  const rank = (id: BadgeId & RankId): Badge => {
    const lv = rankLevel(id);
    const target = xpAtLevel(lv);
    return {
      id,
      earned: level >= lv,
      progress: { value: Math.min(Math.max(0, Math.floor(total)), target), target },
    };
  };

  return [
    counter('firstFocus', history.length, 1),
    counter('focus10h', focusMin / 60, BADGE_RULES.focusHours),
    counter('streak7', longestFocusStreak(history), BADGE_RULES.focusStreakDays),
    counter('firstProject', projectsDone, 1),
    counter('tasks50', tasksDone, BADGE_RULES.tasksDone),
    rank('apprentice'),
    rank('practitioner'),
    rank('expert'),
  ];
}
