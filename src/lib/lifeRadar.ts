/**
 * Wheel of Life / Life Map radar geometry + coaching helpers.
 *
 * Pure SVG-friendly math (no chart library). Scores are 1..10.
 * Coaching prompts follow coaching best practice: define “10”,
 * notice the shape, pick one area, ask what +1 looks like, one small action.
 */
import type { LifeMapArea } from './lifemap';
import { areaGap, suggestNextStep } from './lifemap';
import { createI18n, type I18n } from './i18n';

const EN_I18N = createI18n('en');

export type WheelAssistMode = 'reflect' | 'action';

export interface RadarPoint {
  x: number;
  y: number;
  angle: number;
}

/** Polar → cartesian. 0° is top (12 o’clock), clockwise. */
export function polarPoint(cx: number, cy: number, r: number, angleDeg: number): RadarPoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
    angle: angleDeg,
  };
}

/** Clamp a Wheel-of-Life score into 1..max (default 10). */
export function clampWheelScore(n: number, max = 10): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, Math.round(n)));
}

/**
 * Radius for a 1..max score inside an outer radius.
 * Score 1 sits on an inner floor so the polygon never collapses to a point.
 */
export function scoreRadius(score: number, outerR: number, max = 10, floorRatio = 0.12): number {
  const s = clampWheelScore(score, max);
  const floor = outerR * floorRatio;
  return floor + ((s - 1) / (max - 1)) * (outerR - floor);
}

/** Build SVG polygon points string for a list of scores around the wheel. */
export function radarPolygon(
  scores: number[],
  cx: number,
  cy: number,
  outerR: number,
  max = 10,
): string {
  if (!Array.isArray(scores) || scores.length === 0) return '';
  const n = scores.length;
  const step = 360 / n;
  return scores
    .map((s, i) => {
      const p = polarPoint(cx, cy, scoreRadius(s, outerR, max), i * step);
      return `${round(p.x)},${round(p.y)}`;
    })
    .join(' ');
}

/** Spoke / label angle for area index i of n. */
export function spokeAngle(i: number, n: number): number {
  if (n <= 0) return 0;
  return (i * 360) / n;
}

/** Label anchor slightly outside the outer ring. */
export function labelPoint(
  i: number,
  n: number,
  cx: number,
  cy: number,
  outerR: number,
  pad = 18,
): RadarPoint {
  return polarPoint(cx, cy, outerR + pad, spokeAngle(i, n));
}

/** Areas ranked by weighted gap (biggest need first). */
export function rankNeglected(areas: LifeMapArea[]): LifeMapArea[] {
  if (!Array.isArray(areas) || areas.length === 0) return [];
  return areas
    .slice()
    .sort(
      (a, b) =>
        areaGap(b) - areaGap(a) || b.importance - a.importance || a.name.localeCompare(b.name),
    );
}

/** Lowest current satisfaction (ties → higher importance). */
export function lowestSatisfaction(areas: LifeMapArea[]): LifeMapArea | null {
  if (!Array.isArray(areas) || areas.length === 0) return null;
  return areas
    .slice()
    .sort(
      (a, b) =>
        a.currentScore - b.currentScore || b.importance - a.importance || areaGap(b) - areaGap(a),
    )[0];
}

/** Compact context for libreAssist / local model. */
export function buildWheelAssistPrompt(areas: LifeMapArea[], mode: WheelAssistMode): string {
  const list = Array.isArray(areas) ? areas : [];
  const lines = list
    .map(
      (a) =>
        `${a.name}: now ${a.currentScore}/10, want ${a.desiredScore}/10, matters ${a.importance}/5` +
        (a.intention.trim() ? ` — ${a.intention.trim()}` : ''),
    )
    .join('\n');
  const focus = suggestNextStep(list);
  const focusLine = focus
    ? `Focus candidate: ${focus.area.name} (gap weighted ${areaGap(focus.area)}).`
    : 'All areas meet their desire.';
  if (mode === 'reflect') {
    return (
      'Wheel of Life coaching. Given these satisfaction scores, ask 3 short reflection questions ' +
      '(max 80 words total). Cover: what surprises them about the shape, why the focus area scored that way, ' +
      'and what +1 on that area would look like this week. No lecture.\n\n' +
      `${focusLine}\nScores:\n${lines || '(empty map)'}`
    );
  }
  return (
    'Wheel of Life coaching. Suggest ONE tiny next action (≤15 minutes) for the most important gap. ' +
    'One sentence why, then the action. Max 60 words. Concrete, kind, no jargon.\n\n' +
    `${focusLine}\nScores:\n${lines || '(empty map)'}`
  );
}

/**
 * Fail-closed local coach when Ollama isn’t configured or unreachable.
 * Uses existing suggestNextStep / gap logic — never invents private data.
 */
export function ruleBasedWheelCoach(
  areas: LifeMapArea[],
  mode: WheelAssistMode,
  i18n: I18n = EN_I18N,
): string {
  const list = Array.isArray(areas) ? areas : [];
  if (list.length === 0) return i18n.t('lifemap.balance.empty');
  const step = suggestNextStep(list);
  const low = lowestSatisfaction(list);
  if (mode === 'reflect') {
    const name = step?.area.name ?? low?.name ?? list[0].name;
    const score = step?.area.currentScore ?? low?.currentScore ?? 5;
    return i18n.t('lifemap.coach.reflect', { name, score });
  }
  if (!step) return i18n.t('lifemap.balance.all');
  const intention = step.area.intention.trim();
  return intention
    ? i18n.t('lifemap.coach.actionWith', { name: step.area.name, intention })
    : i18n.t('lifemap.coach.actionPlain', { name: step.area.name });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
