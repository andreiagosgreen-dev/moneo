/**
 * Engagement heuristic for progressive disclosure (Roadmap Faza 2).
 *
 * Brand-new users (no sessions, no projects) get the calm core flow:
 * Focus timer, today's plan, next block, one recommendation. Everything
 * else unfolds once they have done a few sessions or created a project.
 * Pure and total — never throws.
 */

export const ENGAGED_SESSION_THRESHOLD = 5;

export function isEngagedUser(
  history: Array<{ min?: number }>,
  projects: Array<{ archived?: boolean }>,
): boolean {
  if (!Array.isArray(history) || !Array.isArray(projects)) return false;
  if (history.length >= ENGAGED_SESSION_THRESHOLD) return true;
  return projects.some((p) => p && !p.archived);
}
