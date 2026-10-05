/**
 * Free / libre AI path (Ollama or OpenAI-compatible local base).
 *
 * Fail-closed: missing/invalid env or unreachable host → {ok:false}.
 * Never hardcodes keys. Browser only talks to the URL the user set
 * (typically http://127.0.0.1:11434). No secrets in VITE_* beyond a
 * public base URL + model name.
 */
export function ollamaConfig(): { baseUrl: string; model: string } | null {
  const raw = (import.meta.env.VITE_AI_OLLAMA_URL as string | undefined)?.trim() ?? '';
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const model = (
    (import.meta.env.VITE_AI_OLLAMA_MODEL as string | undefined)?.trim() || 'llama3.2'
  ).slice(0, 80);
  return { baseUrl: url.origin + url.pathname.replace(/\/$/, ''), model };
}

export function isLibreAiConfigured(): boolean {
  return ollamaConfig() !== null;
}

async function chatCompletion(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  timeoutMs = 20_000,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Prefer OpenAI-compatible /v1/chat/completions (Ollama supports it).
    const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
    };
    const text = data?.choices?.[0]?.message?.content ?? data?.message?.content ?? '';
    return typeof text === 'string' && text.trim() ? text.trim().slice(0, 4000) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Libre chat for the in-app assistant. Fail-closed → caller keeps rule-based reply.
 */
export async function libreAssist(
  prompt: string,
  contextBlurb: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const cfg = ollamaConfig();
  if (!cfg) return { ok: false, reason: 'unconfigured' };
  const clean = prompt.trim().slice(0, 1500);
  if (!clean) return { ok: false, reason: 'empty' };
  const system =
    'You are Moneo, a calm focus & planning bot. Help with focus sessions, ' +
    'day/week plans and long horizons (1y-life). Be concise (max 120 words). ' +
    'Never invent private data. If unsure, suggest one concrete next step.';
  const user = contextBlurb ? `${contextBlurb}\n\nUser: ${clean}` : clean;
  const text = await chatCompletion(cfg.baseUrl, cfg.model, system, user, 18_000);
  if (!text) return { ok: false, reason: 'unreachable' };
  return { ok: true, text };
}
