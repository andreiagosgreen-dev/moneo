/* Move module: AI workout packs (Pro), client side.
 *
 * Sends the user's request and the catalogue of exercises they can do
 * (ids + main muscle + equipment + level, no free text) to the Worker,
 * which asks Cloudflare Workers AI. Any miss falls back to the on-device
 * reading of the same text (packText.ts).
 */
import type { Equipment, FitPlace } from './library';
import { cleanChoice, usableExercises, type PackChoice } from './packs';

export function packCatalog(place: FitPlace, gear: readonly Equipment[]): string[] {
  return usableExercises(place, gear).map(
    (e) => `${e.id}|${e.muscles[0]}|${e.equipment}|${e.level}`,
  );
}

export type AiPackResult =
  | { ok: true; choice: PackChoice; exercises: string[] }
  | { ok: false; reason: 'signed-out' | 'not-pro' | 'daily-limit' | 'busy' | 'failed' };

export async function aiPack(
  text: string,
  catalog: string[],
  getAccessToken: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<AiPackResult> {
  try {
    const token = await getAccessToken();
    if (!token) return { ok: false, reason: 'signed-out' };
    const res = await fetchImpl('/api/ai/workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: text.trim().slice(0, 300), catalog }),
    });
    if (!res.ok) {
      let code = '';
      try {
        code = String(((await res.json()) as { code?: unknown }).code ?? '');
      } catch {
        /* no body */
      }
      if (res.status === 403) return { ok: false, reason: 'not-pro' };
      if (code === 'daily_limit') return { ok: false, reason: 'daily-limit' };
      if (code === 'busy') return { ok: false, reason: 'busy' };
      return { ok: false, reason: 'failed' };
    }
    const j = (await res.json()) as Record<string, unknown>;
    const choice = cleanChoice({
      zone: j.zone,
      minutes: Number(j.minutes),
      format: j.format,
      level: Number(j.level),
    });
    if (!choice) return { ok: false, reason: 'failed' };
    const exercises = Array.isArray(j.exercises)
      ? j.exercises.filter((e): e is string => typeof e === 'string')
      : [];
    return { ok: true, choice, exercises };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
