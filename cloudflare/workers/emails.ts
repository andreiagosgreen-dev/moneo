/**
 * Lifecycle emails through Resend: one welcome email after the first sign-in
 * and one reminder if an account has gone quiet for a week. Both are sent at
 * most once per account (KV guards) and carry a one-click unsubscribe link.
 * Without RESEND_API_KEY everything here is a silent no-op.
 */
import type { FetchImpl } from './account';
import type { DiscountKV } from './discount';
import { writeEvent, type AnalyticsDataset } from './events';

export interface EmailEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  RESEND_API_KEY?: string;
  /** Sender, e.g. `Moneo <no-reply@moneo.bond>` (domain verified in Resend). */
  EMAIL_FROM?: string;
  KV_CACHE?: DiscountKV;
  /** Funnel counters: one anonymous "sign_up" per new account, by channel. */
  EVENTS?: AnalyticsDataset;
}

export const SITE = 'https://moneo.bond';
const DEFAULT_FROM = 'Moneo <no-reply@moneo.bond>';
const REPLY_TO = 'atsolutionsrl.md@gmail.com';
const DAY = 86_400_000;
/** Resend's free plan allows 100 emails a day; leave room for auth emails. */
export const MAX_REMINDERS_PER_RUN = 60;

export const EMAIL_LANGS = ['en', 'ro', 'ru', 'uk', 'de', 'fr', 'es', 'it'] as const;
export type EmailLang = (typeof EMAIL_LANGS)[number];

const TZ_LANG: Array<[RegExp, EmailLang]> = [
  [/^Europe\/(Chisinau|Bucharest)$/, 'ro'],
  [/^Europe\/(Kyiv|Kiev|Uzhgorod|Zaporozhye)$/, 'uk'],
  [/^Europe\/(Moscow|Minsk)$/, 'ru'],
  [/^Europe\/(Berlin|Vienna|Zurich)$/, 'de'],
  [/^Europe\/Paris$/, 'fr'],
  [/^Europe\/Madrid$/, 'es'],
  [/^Europe\/Rome$/, 'it'],
];

/** App language first, then a guess from the time zone, else English. */
export function pickLang(locale?: string | null, timeZone?: string | null): EmailLang {
  const code = (locale ?? '').slice(0, 2).toLowerCase();
  if ((EMAIL_LANGS as readonly string[]).includes(code)) return code as EmailLang;
  for (const [re, lang] of TZ_LANG) if (re.test(timeZone ?? '')) return lang;
  return 'en';
}

interface Copy {
  subject: string;
  lines: string[];
  cta: string;
  unsub: string;
}

const WELCOME: Record<EmailLang, Copy> = {
  en: {
    subject: 'Welcome to Moneo',
    lines: [
      'Your account is ready. Here is a good way to start:',
      '1. Write today’s list and pick the one task that matters most.',
      '2. Start a 25-minute focus session on it.',
      '3. Try a ready-made system in Projects, for example “Stop procrastinating”.',
    ],
    cta: 'Open Moneo',
    unsub: 'Don’t want these emails? Unsubscribe',
  },
  ro: {
    subject: 'Bun venit în Moneo',
    lines: [
      'Contul tău e gata. Iată un început bun:',
      '1. Scrie lista de azi și alege sarcina cea mai importantă.',
      '2. Pornește o sesiune de focus de 25 de minute pe ea.',
      '3. Încearcă un sistem gata făcut din Proiecte, de exemplu „Gata cu amânarea”.',
    ],
    cta: 'Deschide Moneo',
    unsub: 'Nu vrei aceste emailuri? Dezabonează-te',
  },
  ru: {
    subject: 'Добро пожаловать в Moneo',
    lines: [
      'Ваш аккаунт готов. Хорошее начало:',
      '1. Запишите список на сегодня и выберите самую важную задачу.',
      '2. Запустите на ней 25-минутную сессию фокуса.',
      '3. Попробуйте готовую систему в «Проектах», например «Хватит откладывать».',
    ],
    cta: 'Открыть Moneo',
    unsub: 'Не хотите получать эти письма? Отписаться',
  },
  uk: {
    subject: 'Ласкаво просимо до Moneo',
    lines: [
      'Ваш акаунт готовий. Гарний початок:',
      '1. Запишіть список на сьогодні й оберіть найважливіше завдання.',
      '2. Запустіть на ньому 25-хвилинну сесію фокусу.',
      '3. Спробуйте готову систему в «Проєктах», наприклад «Досить відкладати».',
    ],
    cta: 'Відкрити Moneo',
    unsub: 'Не хочете отримувати ці листи? Відписатися',
  },
  de: {
    subject: 'Willkommen bei Moneo',
    lines: [
      'Dein Konto ist bereit. So startest du gut:',
      '1. Schreib die Liste für heute und wähle die wichtigste Aufgabe.',
      '2. Starte dafür eine 25-Minuten-Fokussitzung.',
      '3. Probiere ein fertiges System unter „Projekte“, zum Beispiel „Schluss mit Aufschieben“.',
    ],
    cta: 'Moneo öffnen',
    unsub: 'Keine solchen E-Mails mehr? Abmelden',
  },
  fr: {
    subject: 'Bienvenue sur Moneo',
    lines: [
      'Ton compte est prêt. Voici un bon début :',
      '1. Écris la liste du jour et choisis la tâche la plus importante.',
      '2. Lance une session de focus de 25 minutes dessus.',
      '3. Essaie un système prêt à l’emploi dans Projets, par exemple « Fini la procrastination ».',
    ],
    cta: 'Ouvrir Moneo',
    unsub: 'Tu ne veux plus ces e-mails ? Se désabonner',
  },
  es: {
    subject: 'Bienvenido a Moneo',
    lines: [
      'Tu cuenta está lista. Un buen comienzo:',
      '1. Escribe la lista de hoy y elige la tarea más importante.',
      '2. Empieza una sesión de enfoque de 25 minutos con ella.',
      '3. Prueba un sistema listo en Proyectos, por ejemplo «Deja de posponer».',
    ],
    cta: 'Abrir Moneo',
    unsub: '¿No quieres estos correos? Darse de baja',
  },
  it: {
    subject: 'Benvenuto in Moneo',
    lines: [
      'Il tuo account è pronto. Un buon inizio:',
      '1. Scrivi la lista di oggi e scegli l’attività più importante.',
      '2. Avvia una sessione di focus di 25 minuti su di essa.',
      '3. Prova un sistema pronto in Progetti, ad esempio «Basta rimandare».',
    ],
    cta: 'Apri Moneo',
    unsub: 'Non vuoi queste email? Annulla l’iscrizione',
  },
};

const REMINDER: Record<EmailLang, Copy> = {
  en: {
    subject: 'Your next step is waiting',
    lines: [
      'It has been a week since your last focus session.',
      'No need to catch up on everything — open Moneo, pick one small task and give it 25 minutes.',
      'This is the only reminder we send.',
    ],
    cta: 'Start a session',
    unsub: 'Don’t want these emails? Unsubscribe',
  },
  ro: {
    subject: 'Următorul tău pas te așteaptă',
    lines: [
      'A trecut o săptămână de la ultima ta sesiune de focus.',
      'Nu trebuie să recuperezi tot — deschide Moneo, alege o sarcină mică și dă-i 25 de minute.',
      'Este singura reamintire pe care o trimitem.',
    ],
    cta: 'Începe o sesiune',
    unsub: 'Nu vrei aceste emailuri? Dezabonează-te',
  },
  ru: {
    subject: 'Ваш следующий шаг ждёт',
    lines: [
      'Прошла неделя с вашей последней сессии фокуса.',
      'Не нужно догонять всё сразу — откройте Moneo, выберите одну небольшую задачу и уделите ей 25 минут.',
      'Это единственное напоминание, которое мы отправляем.',
    ],
    cta: 'Начать сессию',
    unsub: 'Не хотите получать эти письма? Отписаться',
  },
  uk: {
    subject: 'Ваш наступний крок чекає',
    lines: [
      'Минув тиждень від вашої останньої сесії фокусу.',
      'Не треба надолужувати все одразу — відкрийте Moneo, оберіть одне невелике завдання й приділіть йому 25 хвилин.',
      'Це єдине нагадування, яке ми надсилаємо.',
    ],
    cta: 'Почати сесію',
    unsub: 'Не хочете отримувати ці листи? Відписатися',
  },
  de: {
    subject: 'Dein nächster Schritt wartet',
    lines: [
      'Seit deiner letzten Fokussitzung ist eine Woche vergangen.',
      'Du musst nicht alles nachholen — öffne Moneo, wähle eine kleine Aufgabe und gib ihr 25 Minuten.',
      'Das ist die einzige Erinnerung, die wir senden.',
    ],
    cta: 'Sitzung starten',
    unsub: 'Keine solchen E-Mails mehr? Abmelden',
  },
  fr: {
    subject: 'Ta prochaine étape t’attend',
    lines: [
      'Cela fait une semaine depuis ta dernière session de focus.',
      'Pas besoin de tout rattraper — ouvre Moneo, choisis une petite tâche et donne-lui 25 minutes.',
      'C’est le seul rappel que nous envoyons.',
    ],
    cta: 'Lancer une session',
    unsub: 'Tu ne veux plus ces e-mails ? Se désabonner',
  },
  es: {
    subject: 'Tu siguiente paso te espera',
    lines: [
      'Ha pasado una semana desde tu última sesión de enfoque.',
      'No hace falta ponerte al día con todo: abre Moneo, elige una tarea pequeña y dale 25 minutos.',
      'Es el único recordatorio que enviamos.',
    ],
    cta: 'Empezar una sesión',
    unsub: '¿No quieres estos correos? Darse de baja',
  },
  it: {
    subject: 'Il tuo prossimo passo ti aspetta',
    lines: [
      'È passata una settimana dalla tua ultima sessione di focus.',
      'Non serve recuperare tutto: apri Moneo, scegli una piccola attività e dalle 25 minuti.',
      'È l’unico promemoria che inviamo.',
    ],
    cta: 'Inizia una sessione',
    unsub: 'Non vuoi queste email? Annulla l’iscrizione',
  },
};

export type EmailKind = 'welcome' | 'reminder';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Subject, HTML and plain-text bodies for one email. */
export function renderEmail(
  kind: EmailKind,
  lang: EmailLang,
  unsubUrl: string,
): { subject: string; html: string; text: string } {
  const c = (kind === 'welcome' ? WELCOME : REMINDER)[lang];
  const paragraphs = c.lines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  const html =
    `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2a24">` +
    `<div style="max-width:520px;margin:0 auto;padding:32px 24px">` +
    `<p style="margin:0 0 20px;font-size:20px;font-weight:700">Moneo</p>` +
    `<div style="font-size:15px;line-height:1.55">${paragraphs}</div>` +
    `<p style="margin:24px 0"><a href="${SITE}/" style="display:inline-block;background:#c46f4a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${escapeHtml(c.cta)}</a></p>` +
    `<p style="margin:32px 0 0;font-size:12px;color:#6b726c"><a href="${escapeHtml(unsubUrl)}" style="color:#6b726c">${escapeHtml(c.unsub)}</a></p>` +
    `</div></body></html>`;
  const text = `${c.lines.join('\n')}\n\n${c.cta}: ${SITE}/\n\n${c.unsub}: ${unsubUrl}\n`;
  return { subject: c.subject, html, text };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signed token so only the recipient's link can unsubscribe that account. */
export async function unsubToken(userId: string, secret: string): Promise<string> {
  return (await hmacHex(secret, `unsub:${userId}`)).slice(0, 32);
}

export async function unsubUrl(userId: string, secret: string): Promise<string> {
  const s = await unsubToken(userId, secret);
  return `${SITE}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&s=${s}`;
}

const kvKey = {
  welcome: (id: string) => `mail:welcome:${id}`,
  reminder: (id: string) => `mail:reminder:${id}`,
  unsub: (id: string) => `mail:unsub:${id}`,
  lang: (id: string) => `mail:lang:${id}`,
  seen: (id: string) => `mail:seen:${id}`,
};

/** Account deletion: drop every lifecycle-email marker for that account. */
export async function forgetEmailMarkers(
  kv: DiscountKV | undefined,
  userId: string,
): Promise<void> {
  if (!kv) return;
  await Promise.all(
    [kvKey.welcome, kvKey.reminder, kvKey.unsub, kvKey.lang, kvKey.seen].map((k) =>
      kv.delete(k(userId)).catch(() => undefined),
    ),
  );
}

async function sendEmail(
  env: EmailEnv,
  fetchImpl: FetchImpl,
  to: string,
  mail: { subject: string; html: string; text: string },
  unsub: string,
): Promise<boolean> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
  });
  return res.ok;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

/**
 * POST /api/email/welcome — the app calls this once after sign-in with the
 * user's JWT and its language. Sends the welcome email once per account,
 * only for accounts created in the last 7 days.
 */
export async function handleWelcome(
  request: Request,
  env: EmailEnv,
  fetchImpl: FetchImpl = fetch,
  now: number = Date.now(),
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.KV_CACHE) {
    return json({ sent: false, reason: 'not_configured' });
  }
  const userRes = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401);
  const user = (await userRes.json()) as AuthUser;
  if (!user?.id || !user.email) return json({ error: 'unauthorized' }, 401);

  let body: { locale?: unknown; s?: unknown; c?: unknown; count?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* no body */
  }
  const lang = pickLang(String(body.locale ?? ''));
  await env.KV_CACHE.put(kvKey.lang(user.id), lang);

  // Count each new account once (its first sign-in), by the channel the app
  // reports — unless the browser asked not to be counted.
  const createdAt = Date.parse(user.created_at ?? '');
  if (
    body.count !== false &&
    Number.isFinite(createdAt) &&
    now - createdAt < 2 * DAY &&
    !(await env.KV_CACHE.get(kvKey.seen(user.id)))
  ) {
    await env.KV_CACHE.put(kvKey.seen(user.id), String(now));
    writeEvent(env, {
      name: 'sign_up',
      lang,
      source: typeof body.s === 'string' ? body.s : '',
      campaign: typeof body.c === 'string' ? body.c : '',
    });
  }

  if (!env.RESEND_API_KEY) return json({ sent: false, reason: 'not_configured' });
  const created = Date.parse(user.created_at ?? '');
  if (!Number.isFinite(created) || now - created > 7 * DAY) {
    return json({ sent: false, reason: 'not_new' });
  }
  if (await env.KV_CACHE.get(kvKey.welcome(user.id))) {
    return json({ sent: false, reason: 'already_sent' });
  }
  if (await env.KV_CACHE.get(kvKey.unsub(user.id))) {
    return json({ sent: false, reason: 'unsubscribed' });
  }
  // Mark first so a retry or a second tab cannot send twice.
  await env.KV_CACHE.put(kvKey.welcome(user.id), String(now));
  const unsub = await unsubUrl(user.id, env.SUPABASE_SERVICE_ROLE_KEY);
  const ok = await sendEmail(
    env,
    fetchImpl,
    user.email,
    renderEmail('welcome', lang, unsub),
    unsub,
  );
  if (!ok) await env.KV_CACHE.delete(kvKey.welcome(user.id));
  return json({ sent: ok });
}

const UNSUB_PAGE = (done: boolean) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Moneo</title></head>` +
  `<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;color:#1f2a24">` +
  (done
    ? '<h1 style="font-size:20px">You are unsubscribed · Te-ai dezabonat</h1><p>You will not get welcome or reminder emails from Moneo any more. Account emails (sign-in, password reset) still arrive.</p><p>Nu mai primești emailuri de bun venit sau de reamintire de la Moneo. Emailurile contului (autentificare, resetarea parolei) vin în continuare.</p>'
    : '<h1 style="font-size:20px">Link not valid · Link invalid</h1><p>Write to atsolutionsrl.md@gmail.com and we will unsubscribe you.</p>') +
  `<p><a href="${SITE}/">moneo.bond</a></p></body></html>`;

/** GET or one-click POST /api/email/unsubscribe?u=<user id>&s=<signature>. */
export async function handleUnsubscribe(request: Request, env: EmailEnv): Promise<Response> {
  const url = new URL(request.url);
  const u = url.searchParams.get('u') ?? '';
  const s = url.searchParams.get('s') ?? '';
  let done = false;
  if (u && s && env.SUPABASE_SERVICE_ROLE_KEY && env.KV_CACHE) {
    const expected = await unsubToken(u, env.SUPABASE_SERVICE_ROLE_KEY);
    if (expected.length === s.length && expected === s) {
      await env.KV_CACHE.put(kvKey.unsub(u), String(Date.now()));
      done = true;
    }
  }
  if (request.method === 'POST')
    return new Response(done ? 'ok' : 'invalid', { status: done ? 200 : 400 });
  return new Response(UNSUB_PAGE(done), {
    status: done ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** An account gets one reminder when it is 7–60 days old and quiet for a week. */
export function needsReminder(user: AuthUser, activeIds: Set<string>, now: number): boolean {
  if (!user.email || !user.email_confirmed_at) return false;
  const created = Date.parse(user.created_at ?? '');
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  if (age < 7 * DAY || age > 60 * DAY) return false;
  const lastSignIn = Date.parse(user.last_sign_in_at ?? '');
  if (Number.isFinite(lastSignIn) && now - lastSignIn < 7 * DAY) return false;
  return !activeIds.has(user.id);
}

async function listUsers(env: EmailEnv, fetchImpl: FetchImpl): Promise<AuthUser[]> {
  const out: AuthUser[] = [];
  for (let page = 1; page <= 25; page++) {
    const res = await fetchImpl(
      `${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) break;
    const users = ((await res.json()) as { users?: AuthUser[] }).users ?? [];
    out.push(...users);
    if (users.length < 200) break;
  }
  return out;
}

/** Accounts with a synced focus session in the last 7 days count as active. */
async function activeUserIds(
  env: EmailEnv,
  fetchImpl: FetchImpl,
  now: number,
): Promise<Set<string>> {
  const since = new Date(now - 7 * DAY).toISOString();
  const res = await fetchImpl(
    `${env.SUPABASE_URL}/rest/v1/focus_sessions?select=user_id&completed_at=gte.${encodeURIComponent(since)}&limit=20000`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`focus_sessions ${res.status}`);
  const rows = (await res.json()) as Array<{ user_id?: string }>;
  return new Set(rows.map((r) => r.user_id ?? '').filter(Boolean));
}

/** Daily cron: send the one-time reminder to quiet accounts. */
export async function runReminders(
  env: EmailEnv,
  fetchImpl: FetchImpl = fetch,
  now: number = Date.now(),
): Promise<{ sent: number; skipped?: string }> {
  if (!env.RESEND_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.KV_CACHE) {
    return { sent: 0, skipped: 'not_configured' };
  }
  // If activity can't be read, send nothing rather than nag active people.
  const active = await activeUserIds(env, fetchImpl, now);
  const users = await listUsers(env, fetchImpl);
  let sent = 0;
  for (const user of users) {
    if (sent >= MAX_REMINDERS_PER_RUN) break;
    if (!needsReminder(user, active, now)) continue;
    if (await env.KV_CACHE.get(kvKey.reminder(user.id))) continue;
    if (await env.KV_CACHE.get(kvKey.unsub(user.id))) continue;
    const meta = user.user_metadata ?? {};
    const lang = pickLang(
      (await env.KV_CACHE.get(kvKey.lang(user.id))) ?? String(meta.locale ?? ''),
      String(meta.timezone ?? ''),
    );
    await env.KV_CACHE.put(kvKey.reminder(user.id), String(now));
    const unsub = await unsubUrl(user.id, env.SUPABASE_SERVICE_ROLE_KEY);
    const ok = await sendEmail(
      env,
      fetchImpl,
      user.email!,
      renderEmail('reminder', lang, unsub),
      unsub,
    );
    if (ok) sent += 1;
    else await env.KV_CACHE.delete(kvKey.reminder(user.id));
  }
  return { sent };
}
