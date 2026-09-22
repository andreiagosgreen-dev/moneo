/* Weekly Recap (progress companion, shareable).
 *
 * Pure weekly aggregation + guarded canvas PNG export. The card answers
 * "what did my focus move this week": total minutes, session count, daily
 * bars, top projects by minutes (with live task-target percent) and the
 * goals already in motion. Image export is Free — the recap is the viral
 * loop, not a Pro export (CSV/PDF gating is untouched).
 * Never throws; canvas absence fails soft (returns false).
 */
import type { Session } from './store';
import { currentStreak } from './store';
import type { Project } from './projects';
import { projectCompletion, type Task } from './tasks';
import { goalProgress, type Goal } from './goals';
import { rangeDayKeys } from './reports';
import { dayKeyInTz } from './timezone';

export interface RecapProject {
  projectId: string;
  name: string;
  color: string;
  min: number;
  sessions: number;
  /** Live task-target percent, null while the project has no tasks. */
  pct: number | null;
}

export interface RecapGoal {
  goalId: string;
  title: string;
  pct: number;
}

export interface RecapDay {
  key: string;
  min: number;
}

export interface WeeklyRecap {
  /** 7 day keys, oldest → newest, in the given timezone. */
  dayKeys: string[];
  days: RecapDay[];
  totalMin: number;
  sessionCount: number;
  topProjects: RecapProject[];
  goalsInMotion: RecapGoal[];
  streak: number;
}

export interface RecapInput {
  history: Session[];
  projects: Project[];
  tasks: Task[];
  goals: Goal[];
  timezone: string;
  /** Test seam: fixed day keys instead of the trailing calendar week. */
  dayKeys?: string[];
}

/** Aggregate one shareable week. */
export function buildWeeklyRecap(input: RecapInput): WeeklyRecap {
  const dayKeys = input.dayKeys ?? rangeDayKeys('week', input.timezone);
  const inWeek = new Set(dayKeys);
  const keyOf = (at: number) => dayKeyInTz(at, input.timezone);
  const weekSessions = input.history.filter((s) => inWeek.has(keyOf(s.at)));

  const dayTotals = new Map<string, number>();
  for (const key of dayKeys) dayTotals.set(key, 0);
  for (const s of weekSessions) dayTotals.set(keyOf(s.at), (dayTotals.get(keyOf(s.at)) ?? 0) + s.min);

  const byProject = new Map<string, { min: number; sessions: number }>();
  for (const s of weekSessions) {
    if (!s.projectId) continue;
    const acc = byProject.get(s.projectId) ?? { min: 0, sessions: 0 };
    acc.min += s.min;
    acc.sessions += 1;
    byProject.set(s.projectId, acc);
  }
  const projectById = new Map(input.projects.map((p) => [p.id, p]));
  const topProjects: RecapProject[] = [...byProject.entries()]
    .map(([projectId, v]) => {
      const p = projectById.get(projectId);
      const { done, total } = projectCompletion(input.tasks, projectId);
      return {
        projectId,
        name: p?.name ?? '—',
        color: p?.color ?? '#888',
        min: v.min,
        sessions: v.sessions,
        pct: total > 0 ? Math.round((done / total) * 100) : null,
      };
    })
    .sort((a, b) => b.min - a.min)
    .slice(0, 3);

  const goalsInMotion: RecapGoal[] = input.goals
    .filter((g) => !g.archived)
    .map((g) => ({ goalId: g.id, title: g.title, pct: goalProgress(input.goals, input.tasks, g.id) }))
    .filter((g) => g.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return {
    dayKeys,
    days: dayKeys.map((key) => ({ key, min: dayTotals.get(key) ?? 0 })),
    totalMin: weekSessions.reduce((sum, s) => sum + s.min, 0),
    sessionCount: weekSessions.length,
    topProjects,
    goalsInMotion,
    streak: currentStreak(input.history),
  };
}

/* ---------------- share image (canvas, no dependencies) ---------------- */

export interface RecapStrings {
  title: string;
  weekLabel: string;
  sessionsLabel: string;
  /** Fully composed streak line, e.g. "5-day streak" (locale pluralized by caller). */
  streakLine: string;
  topLabel: string;
  brand: string;
}

export const RECAP_W = 1080;
export const RECAP_H = 1350;

/** Paint the share card. False when canvas 2d is unavailable (test envs). */
export function drawRecapCard(
  canvas: HTMLCanvasElement,
  recap: WeeklyRecap,
  s: RecapStrings,
  formatDur: (min: number) => string,
): boolean {
  try {
    canvas.width = RECAP_W;
    canvas.height = RECAP_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const BG = '#141412';
    const INK = '#f2f4f9';
    const MUTED = '#9aa39b';
    const ACCENT = '#e8b34b';
    const BAR_BG = 'rgba(242,244,249,0.12)';

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, RECAP_W, RECAP_H);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, 0, RECAP_W, 14);

    let y = 120;
    ctx.fillStyle = MUTED;
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.fillText(s.weekLabel.toUpperCase(), 90, y);
    y += 84;
    ctx.fillStyle = INK;
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText(s.title, 90, y);
    y += 120;

    ctx.fillStyle = ACCENT;
    ctx.font = '800 150px system-ui, sans-serif';
    ctx.fillText(formatDur(recap.totalMin), 90, y);
    y += 64;
    ctx.fillStyle = MUTED;
    ctx.font = '400 36px system-ui, sans-serif';
    ctx.fillText(`${recap.sessionCount} ${s.sessionsLabel} · ${s.streakLine}`, 90, y);
    y += 110;

    // Daily bars.
    const maxDay = Math.max(1, ...recap.days.map((d) => d.min));
    const slotW = (RECAP_W - 180) / 7;
    const barMaxH = 220;
    recap.days.forEach((d, i) => {
      const h = Math.max(d.min > 0 ? 10 : 4, (d.min / maxDay) * barMaxH);
      const x = 90 + i * slotW + slotW * 0.22;
      const w = slotW * 0.56;
      ctx.fillStyle = BAR_BG;
      ctx.fillRect(x, y, w, barMaxH);
      ctx.fillStyle = d.min > 0 ? ACCENT : 'rgba(242,244,249,0.25)';
      ctx.fillRect(x, y + barMaxH - h, w, h);
    });
    y += barMaxH + 90;

    // Top projects with progress.
    ctx.fillStyle = MUTED;
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.fillText(s.topLabel.toUpperCase(), 90, y);
    y += 70;
    for (const p of recap.topProjects) {
      ctx.fillStyle = INK;
      ctx.font = '600 42px system-ui, sans-serif';
      const label = p.pct !== null ? `${p.name} · ${p.pct}%` : p.name;
      ctx.fillText(label.slice(0, 34), 90, y);
      y += 30;
      ctx.fillStyle = BAR_BG;
      ctx.fillRect(90, y, RECAP_W - 180, 20);
      ctx.fillStyle = p.color;
      ctx.fillRect(90, y, (RECAP_W - 180) * ((p.pct ?? 0) / 100), 20);
      y += 30;
      ctx.fillStyle = MUTED;
      ctx.font = '400 32px system-ui, sans-serif';
      ctx.fillText(formatDur(p.min), 90, y);
      y += 84;
    }

    for (const g of recap.goalsInMotion) {
      if (y > RECAP_H - 220) break;
      ctx.fillStyle = INK;
      ctx.font = '400 34px system-ui, sans-serif';
      ctx.fillText(`◆ ${g.title.slice(0, 36)} · ${g.pct}%`, 90, y);
      y += 62;
    }

    ctx.fillStyle = MUTED;
    ctx.font = '600 32px system-ui, sans-serif';
    ctx.fillText(s.brand, 90, RECAP_H - 80);
    return true;
  } catch {
    return false;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob !== 'function') return resolve(null);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** Download the card as PNG. False when the browser can't produce it. */
export async function downloadRecapImage(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * System share sheet with the PNG attached. False when Web Share files
 * aren't supported — the caller then falls back to download.
 */
export async function shareRecapImage(
  canvas: HTMLCanvasElement,
  share: { title: string; text: string; filename: string },
): Promise<boolean> {
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { title: string; text: string; files: File[] }) => Promise<void>;
    };
    const blob = await canvasToBlob(canvas);
    if (!blob || typeof nav.canShare !== 'function' || typeof nav.share !== 'function') {
      return false;
    }
    const file = new File([blob], share.filename, { type: 'image/png' });
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({ title: share.title, text: share.text, files: [file] });
    return true;
  } catch {
    return false;
  }
}
