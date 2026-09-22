/* Exportable portfolio (Faza 29) — "what I built": a self-contained,
 * printable HTML page assembled from completed projects, achieved goals
 * and strong skills. Reuses the exact `escHtml`/print idiom already
 * established by export.ts's report PDF, applied to a new domain.
 */
import { getMinutesForProject, type Project } from './projects';
import { projectCompletion, type Task } from './tasks';
import { goalProgress, type Goal } from './goals';
import type { Skill } from './skills';
import { fmtMinutes } from './store';
import type { Session } from './store';

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PortfolioProject {
  name: string;
  category: string;
  color: string;
  minutesFocused: number;
  taskCount: number;
  doneTaskCount: number;
}

export interface PortfolioData {
  title: string;
  generatedAt: string;
  totalMinutes: number;
  projects: PortfolioProject[];
  goalsAchieved: string[];
  topSkills: Array<{ name: string; level: number }>;
}

/** Skills at level 4+ count as "strong" for the portfolio, most-recent first. */
const STRONG_SKILL_LEVEL = 4;

/**
 * Assemble portfolio data: fully-completed projects (100% task completion,
 * not archived-and-empty), fully-achieved goals, and strong skills.
 * Never throws.
 */
export function buildPortfolioData(
  projects: Project[],
  tasks: Task[],
  goals: Goal[],
  skills: Skill[],
  history: Session[],
  now: number = Date.now(),
): PortfolioData {
  const doneProjects = projects.filter((p) => {
    const { done, total } = projectCompletion(tasks, p.id);
    return total > 0 && done === total;
  });
  const projectRows: PortfolioProject[] = doneProjects
    .map((p) => {
      const { done, total } = projectCompletion(tasks, p.id);
      return {
        name: p.name,
        category: p.category,
        color: p.color,
        minutesFocused: getMinutesForProject(p.id, history),
        taskCount: total,
        doneTaskCount: done,
      };
    })
    .sort((a, b) => b.minutesFocused - a.minutesFocused);

  const goalsAchieved = goals
    .filter((g) => !g.archived && goalProgress(goals, tasks, g.id) >= 100)
    .map((g) => g.title);

  const topSkills = skills
    .filter((s) => s.level >= STRONG_SKILL_LEVEL)
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .map((s) => ({ name: s.name, level: s.level }));

  return {
    title: 'Portfolio',
    generatedAt: new Date(now).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    totalMinutes: projectRows.reduce((sum, p) => sum + p.minutesFocused, 0),
    projects: projectRows,
    goalsAchieved,
    topSkills,
  };
}

/** Pure: builds a self-contained, shareable portfolio HTML page. Never throws. */
export function buildPortfolioHTML(d: PortfolioData): string {
  const projectRows = d.projects
    .map(
      (p) =>
        `<li><span class="dot" style="background:${escHtml(p.color)}"></span><b>${escHtml(
          p.name,
        )}</b><span class="meta">${escHtml(p.category)} · ${fmtMinutes(
          p.minutesFocused,
        )} · ${p.doneTaskCount}/${p.taskCount} tasks</span></li>`,
    )
    .join('');
  const goalRows = d.goalsAchieved.map((g) => `<li>${escHtml(g)}</li>`).join('');
  const skillRows = d.topSkills
    .map((s) => `<li><b>${escHtml(s.name)}</b><span class="meta">level ${s.level}/5</span></li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escHtml(d.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 40px; max-width: 720px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta-top { color: #666; font-size: 12px; margin-bottom: 8px; }
  .stat { display: inline-block; font-size: 13px; color: #444; margin-right: 20px; }
  .stat b { font-size: 18px; display: block; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin: 28px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
  li .meta { margin-left: auto; color: #888; font-size: 12px; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .empty { color: #999; font-size: 13px; font-style: italic; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${escHtml(d.title)}</h1>
<p class="meta-top">generated ${escHtml(d.generatedAt)}</p>
<div>
  <span class="stat"><b>${d.projects.length}</b>projects completed</span>
  <span class="stat"><b>${escHtml(fmtMinutes(d.totalMinutes))}</b>focused</span>
  <span class="stat"><b>${d.goalsAchieved.length}</b>goals achieved</span>
</div>
<h2>Completed projects</h2>
${d.projects.length > 0 ? `<ul>${projectRows}</ul>` : '<p class="empty">Nothing completed yet.</p>'}
<h2>Goals achieved</h2>
${d.goalsAchieved.length > 0 ? `<ul>${goalRows}</ul>` : '<p class="empty">No goals fully achieved yet.</p>'}
<h2>Strong skills</h2>
${d.topSkills.length > 0 ? `<ul>${skillRows}</ul>` : '<p class="empty">No skills at level 4+ yet.</p>'}
</body>
</html>`;
}
