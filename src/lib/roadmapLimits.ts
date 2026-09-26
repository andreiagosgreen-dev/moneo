/**
 * Free-plan roadmap slot limit — kept outside `/lib/ai` and `/lib/billing`
 * so Vite manualChunks cannot form a billing ↔ ai-assistant cycle
 * (TDZ at boot → black screen).
 */

/** Free keeps one active plan; Pro is unlimited. */
export const FREE_ROADMAPS_LIMIT = 1;

/** Whether another roadmap may be added (Free: one slot). */
export function canAddRoadmap(isPro: boolean, existingCount: number): boolean {
  return isPro || existingCount < FREE_ROADMAPS_LIMIT;
}
