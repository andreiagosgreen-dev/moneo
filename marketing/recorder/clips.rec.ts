import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';

/*
 * The app parts of the short videos (the owner's marketing kit: week 1 is
 * C02 C04 C03 C15, week 2 C06 C11 C07 C12, week 3 C05 C09 C14 C10), recorded
 * from the real app in each language. Steps use
 * language-independent selectors; the pace is a calm human one, and a soft
 * circle shows every tap like a phone's "show touches".
 *
 * CLIP_LANGS=ro,ru,en and CLIPS=c02,c04,… pick what to record (default: all).
 *
 * Slow motion: a CI runner renders 1080×1920 frames at only ~10 fps, so the
 * app runs CLIP_SLOW times slower (page clocks, timers, CSS animations and
 * the pauses here) and the frame times are divided by the same factor:
 * ~30 fps in the final video, at normal speed.
 */

type Lang = 'ro' | 'ru' | 'en';
const LANGS = (process.env.CLIP_LANGS ?? 'ro,ru,en')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Lang => s === 'ro' || s === 'ru' || s === 'en');
const ALL_CLIPS = 'c02,c04,c03,c15,c06,c11,c07,c12,c05,c09,c14,c10';
const CLIPS = (process.env.CLIPS || ALL_CLIPS).split(',').map((s) => s.trim());
const SLOW = Math.max(1, Number(process.env.CLIP_SLOW ?? 3) || 1);

const TODAY_TASKS: Record<Lang, string[]> = {
  ro: ['Recapitulez capitolul 2', 'Trimit tema la statistică', 'Sun la bibliotecă'],
  ru: ['Повторить главу 2', 'Сдать задание по статистике', 'Позвонить в библиотеку'],
  en: ['Review chapter 2', 'Send the statistics homework', 'Call the library'],
};

const TEST_TASKS: Record<Lang, string[]> = {
  ro: ['Recapitulez capitolele 1–3', 'Rezolv exercițiile din culegere', 'Întrebările grele'],
  ru: ['Повторить главы 1–3', 'Решить задачи из сборника', 'Сложные вопросы'],
  en: ['Review chapters 1–3', 'Do the practice problems', 'The hard questions'],
};

const GOAL: Record<Lang, string> = {
  ro: 'Învăț Python în 3 luni',
  ru: 'Выучить Python за 3 месяца',
  en: 'Learn Python in 3 months',
};

// One folder of frames per clip, plus an ffconcat list with each frame's
// duration; scripts/collect-clips.mjs turns the lists into MP4s.
const FRAMES_DIR = join(process.cwd(), 'test-results/clip-frames');

/** Fresh app, language set, no first-run screens; a circle shows each tap. */
async function prepare(page: Page, lang: Lang): Promise<void> {
  await page.addInitScript((locale: string) => {
    const set = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
    if (!localStorage.getItem('moneo:recorder')) {
      localStorage.clear();
      set('moneo:recorder', true);
      // Seeded history earns XP; no "new level" notice unless a clip wants one.
      set('moneo:xp-seen', { level: 500 });
    }
    set('moneo:locale', locale);
    set('moneo:landing-seen', true);
    set('moneo:onboarding-seen', true);
    set('moneo:first-steps', { dismissedAt: Date.now() });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date());
    const get = (type: string) => p.find((x) => x.type === type)?.value ?? '1';
    set('moneo:ritual-day', `${get('year')}-${Number(get('month'))}-${Number(get('day'))}`);

    document.addEventListener(
      'pointerdown',
      (e) => {
        const dot = document.createElement('div');
        dot.style.cssText = `position:fixed;z-index:2147483647;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.45);box-shadow:0 0 0 2px rgba(255,255,255,.7);pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
        document.body.appendChild(dot);
        requestAnimationFrame(() => {
          dot.style.transform = 'scale(1.6)';
          dot.style.opacity = '0';
        });
        setTimeout(() => dot.remove(), 600);
      },
      true,
    );
  }, lang);

  // Page time runs SLOW times slower (Date, performance.now, timers, frames);
  // window.__clipSpeed(x) runs it x times faster than that, for time-lapses.
  await page.addInitScript((slow: number) => {
    const realPerf = performance.now.bind(performance);
    const RealDate = Date;
    const p0 = realPerf();
    const d0 = RealDate.now();
    let rate = 1 / slow; // page ms per real ms
    let realBase = p0;
    let pageBase = p0;
    const pageNow = () => pageBase + (realPerf() - realBase) * rate;
    (window as unknown as { __clipSpeed: (x: number) => void }).__clipSpeed = (x) => {
      pageBase = pageNow();
      realBase = realPerf();
      rate = x / slow;
    };
    const dateNow = () => d0 + (pageNow() - p0);
    class SlowDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) super(dateNow());
        else super(...(args as [number]));
      }
      static now() {
        return dateNow();
      }
    }
    window.Date = SlowDate as DateConstructor;
    performance.now = pageNow;

    const realTimeout = window.setTimeout.bind(window);
    const realClearTimeout = window.clearTimeout.bind(window);
    const realClearInterval = window.clearInterval.bind(window);
    const delay = (ms?: number) => Math.max(0, (ms ?? 0) / rate);
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...a: unknown[]) =>
      realTimeout(fn, delay(ms), ...a)) as typeof window.setTimeout;
    // Intervals re-read the speed on every tick, so a time-lapse applies at once.
    const intervals = new Map<number, number>();
    let nextId = 1e9;
    window.setInterval = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
      const id = ++nextId;
      const tick = () => {
        intervals.set(
          id,
          realTimeout(() => {
            if (!intervals.has(id)) return;
            tick();
            if (typeof fn === 'function') (fn as (...x: unknown[]) => void)(...a);
          }, delay(ms)),
        );
      };
      tick();
      return id;
    }) as typeof window.setInterval;
    const clear = (id?: number) => {
      const handle = id === undefined ? undefined : intervals.get(id);
      if (handle === undefined) return false;
      realClearTimeout(handle);
      intervals.delete(id as number);
      return true;
    };
    window.clearInterval = (id?: number) => {
      if (!clear(id)) realClearInterval(id);
    };
    window.clearTimeout = (id?: number) => {
      if (!clear(id)) realClearTimeout(id);
    };
    const realRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => realRaf(() => cb(pageNow()));
  }, SLOW);
}

/** Page time x times faster than normal (1 = normal). */
const speed = (page: Page, x: number) =>
  page.evaluate(
    (v) => (window as unknown as { __clipSpeed: (n: number) => void }).__clipSpeed(v),
    x,
  );

interface Seed {
  /** A ready-made system, built with the app's own code (Pro ones too). */
  template?: string;
  /** Seven days of focus on the template's project; two tasks done. */
  week?: boolean;
  /** The template's habits ticked on each of the previous N days. */
  habitDays?: number;
  /** ~565 XP of focus over the last six days, one session short of a new rank. */
  nearRank?: boolean;
}

/**
 * Local data for a clip, written with the app's own modules through the dev
 * server, then a reload. The recorder has no account, so Pro systems stand
 * in for what a Pro trial user sees.
 */
async function seedApp(page: Page, lang: Lang, seed: Seed): Promise<void> {
  const script = `(async () => {
    const lang = ${JSON.stringify(lang)};
    const seed = ${JSON.stringify(seed)};
    const L = await import('/src/lib/lifeTemplates.ts');
    const I = await import('/src/lib/i18n/index.ts');
    const K = (await import('/src/lib/storage/storageKeys.ts')).STORAGE_KEYS;
    const i18n = I.createI18n(lang, await I.loadDictionary(lang));
    const now = Date.now();
    const day = 864e5;
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const dayKey = (at) => {
      const d = new Date(at);
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    };
    const read = (k, empty) => JSON.parse(localStorage.getItem(k) || JSON.stringify(empty));
    const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    const history = read(K.history, []);
    let projectId;
    if (seed.template) {
      const r = L.instantiateLifeTemplate(L.getLifeTemplate(seed.template), {
        t: i18n.t, now, isPro: true, existingActiveHabits: 0,
      });
      projectId = r.project.id;
      const tasks = r.tasks.map((t, i) =>
        seed.week && i < 2 ? { ...t, status: 'completed', completedAt: now - (5 - i * 2) * day } : t);
      write(K.projects, [...read(K.projects, []), r.project]);
      write(K.tasks, [...read(K.tasks, []), ...tasks]);
      write(K.habits, [...read(K.habits, []), ...r.habits]);
      if (seed.habitDays) {
        const log = read(K.habitLog, {});
        for (const h of r.habits) {
          log[h.id] = [];
          for (let i = seed.habitDays; i >= 1; i--) log[h.id].push(dayKey(now - i * day));
        }
        write(K.habitLog, log);
      }
    }
    const addDays = (plan, withProject) => plan.forEach((mins, i) => {
      const base = midnight.getTime() - (plan.length - 1 - i) * day;
      mins.forEach((min, j) => {
        let at = base + (9 + j * 2) * 36e5;
        if (i === plan.length - 1) at = now - (mins.length - j) * 90 * 6e4;
        history.push({ id: 'rec-' + history.length, at, min,
          ...(withProject && projectId ? { projectId } : {}) });
      });
    });
    if (seed.week) addDays([[25, 25, 45], [45, 45, 25], [], [25, 45, 45, 25], [25], [45, 45, 45], [25, 50]], true);
    if (seed.nearRank) {
      // Previous six days only (today stays empty): 565 XP, level 3.
      addDays([[45, 50], [50, 45], [45, 50], [50, 45], [45, 50], [45, 45], []], false);
      write(K.xpSeen, { level: 3 });
    }
    if (history.length) write(K.history, history);
  })()`;
  await page.evaluate(script);
  await page.reload();
  await nav(page, 'focus').waitFor();
}

/**
 * Time-lapse a running focus session, back to normal speed a few seconds
 * before the end, so the end-of-session moments play at their own pace.
 */
async function fastForward(page: Page): Promise<void> {
  const left = async () => {
    const m = /(\d+):(\d+)/.exec((await page.locator('.atm-time').first().textContent()) ?? '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
  };
  for (const [x, until] of [
    [700, 150],
    [60, 4],
  ] as const) {
    await speed(page, x);
    while ((await left()) > until) await new Promise((r) => setTimeout(r, 15));
  }
  await speed(page, 1);
}

/** After a session: close the summary card and skip the "how did it go?" note. */
async function closeSessionEnd(page: Page): Promise<void> {
  const summary = page.locator('.atm-summary .mono-chip').last();
  if (await summary.isVisible()) await tap(page, summary, 600);
  const skip = page.locator('.dialog-pop:has(textarea) button').first();
  try {
    await skip.waitFor({ state: 'visible', timeout: 3000 * SLOW });
  } catch {
    return;
  }
  await tap(page, skip, 700);
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms * SLOW));

/** Move to the element, then tap it, at a human pace. */
async function tap(page: Page, target: Locator, after = 900): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await pause(300);
  const box = await target.boundingBox();
  if (!box) throw new Error('nothing to tap');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await pause(120);
  await page.mouse.down();
  await pause(70);
  await page.mouse.up();
  await pause(after);
}

async function glide(page: Page, dy: number, ms = 1200): Promise<void> {
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dy / steps);
    await pause(ms / steps);
  }
}

const nav = (page: Page, tab: string) => page.locator(`[data-nav-tab="${tab}"]:visible`).first();
const preset = (page: Page, min: number) =>
  page.locator('.atm-presets .atm-preset').filter({ hasText: new RegExp(`^${min}$`) });
const startButton = (page: Page) => page.locator('.atm-actions .mono-btn-primary').first();

async function useSystem(page: Page, id: string, after = 1800): Promise<void> {
  const card = page.getByTestId(`tpl-${id}`);
  const dy = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 - window.innerHeight / 2;
  });
  await glide(page, dy, 900);
  await pause(300);
  await tap(page, card.locator('button').first(), 600);
  await tap(page, card.locator('.mono-btn-primary'), after);
}

/**
 * Records one clip. Playwright's video and Chrome's screencast give
 * CSS-pixel frames (360×640) in headless mode, so frames are CDP
 * screenshots rendered at 3×, taken back to back (in slow motion).
 * Only `play` is recorded.
 */
async function record(
  page: Page,
  name: string,
  setup: () => Promise<void>,
  play: () => Promise<void>,
): Promise<void> {
  await page.goto('/');
  await nav(page, 'focus').waitFor();
  const cdp = await page.context().newCDPSession(page);
  // CSS transitions and animations, slowed like the page clock.
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  await setup();
  // No leftover "… is ready" toast from the setup in the first frames.
  await page.locator('.mono-toast.show').waitFor({ state: 'hidden', timeout: 60_000 });
  await pause(600);

  const dir = join(FRAMES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: { file: string; t: number }[] = [];
  let recording = true;
  const start = Date.now() / 1000;
  const scrollPos = async () => {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: '[visualViewport.pageLeft, visualViewport.pageTop]',
      returnByValue: true,
    });
    return result.value as [number, number];
  };
  const capture = (async () => {
    while (recording) {
      const t = Date.now() / 1000;
      const [x, y] = await scrollPos();
      // Headless Chrome captures CSS pixels; the clip scale renders at 3×.
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 90,
        optimizeForSpeed: true,
        clip: { x, y, width: 360, height: 640, scale: 3 },
      });
      // A scroll during the capture leaves a blank strip; the next frame is clean.
      const [x2, y2] = await scrollPos();
      if (x2 !== x || y2 !== y) continue;
      const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
      writeFileSync(join(dir, file), Buffer.from(data, 'base64'));
      frames.push({ file, t });
    }
  })();
  await play();
  await pause(800);
  recording = false;
  await capture;
  const end = Date.now() / 1000;
  if (frames.length === 0) throw new Error(`no frames for ${name}`);
  console.log(
    `${name}: ${frames.length} frames, ${((frames.length * SLOW) / (end - start)).toFixed(1)} fps`,
  );

  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    const seconds = Math.max(0.001, (next - f.t) / SLOW);
    lines.push(`file '${f.file}'`, `duration ${seconds.toFixed(3)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  writeFileSync(join(dir, 'frames.txt'), `${lines.join('\n')}\n`);
}

for (const lang of LANGS) {
  test.describe(`clips ${lang}`, () => {
    const clip = (id: string, body: (page: Page) => Promise<void>) => {
      if (!CLIPS.includes(id)) return;
      test(`${id} ${lang}`, async ({ page }) => {
        await prepare(page, lang);
        await body(page);
      });
    };

    clip('c02', async (page) => {
      await record(
        page,
        `${lang}-c02-amanare`,
        async () => {
          await nav(page, 'projects').click();
          await pause(800);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        async () => {
          await useSystem(page, 'procrastination', 2400);
          await glide(page, 160, 900);
          await pause(1400);
          await tap(page, nav(page, 'focus'), 1000);
          await tap(page, preset(page, 15), 800);
          await tap(page, startButton(page), 4500);
        },
      );
    });

    clip('c04', async (page) => {
      await record(
        page,
        `${lang}-c04-3-sarcini`,
        async () => {
          await nav(page, 'today').click();
          await pause(800);
        },
        async () => {
          const input = page.locator('.mono-azi-prio input').first();
          for (const text of TODAY_TASKS[lang]) {
            await tap(page, input, 300);
            await input.pressSequentially(text, { delay: 55 * SLOW });
            await pause(250);
            await input.press('Enter');
            await pause(700);
          }
          await pause(600);
          await tap(page, page.locator('.mono-azi-prio .mono-list-row button').first(), 2600);
        },
      );
    });

    clip('c03', async (page) => {
      await record(
        page,
        `${lang}-c03-pomodoro`,
        async () => {
          await nav(page, 'focus').click();
          await pause(600);
        },
        async () => {
          await pause(1400);
          await tap(page, preset(page, 45), 1800);
          await tap(page, preset(page, 65), 1300);
          await tap(page, preset(page, 45), 1300);
          await tap(page, startButton(page), 5000);
        },
      );
    });

    clip('c15', async (page) => {
      await record(
        page,
        `${lang}-c15-saptamana`,
        async () => {
          // A week with something in it: two free ready-made systems.
          await nav(page, 'projects').click();
          await pause(600);
          for (const id of ['procrastination', 'reading']) {
            const card = page.getByTestId(`tpl-${id}`);
            await card.locator('button').first().click();
            await card.locator('.mono-btn-primary').click();
            await pause(500);
          }
          await nav(page, 'focus').click();
          await pause(500);
        },
        async () => {
          await tap(page, nav(page, 'orar'), 2000);
          await glide(page, 260, 1800);
          await pause(1500);
          await glide(page, 320, 1800);
          await pause(2200);
        },
      );
    });

    clip('c06', async (page) => {
      await record(
        page,
        `${lang}-c06-licenta`,
        async () => {
          await seedApp(page, lang, { template: 'thesis' });
          await nav(page, 'projects').click();
          await pause(600);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        async () => {
          const row = page.locator('[data-project-id]').first();
          const dy = await row.evaluate((el) => el.getBoundingClientRect().top - 90);
          await glide(page, dy, 1000);
          await pause(700);
          await tap(page, row.locator('button').last(), 1600);
          await glide(page, 250, 1100);
          await pause(700);
          // On to the thesis tasks: topic, outline, sources, daily writing.
          await glide(page, 320, 1200);
          await pause(2200);
          await tap(page, nav(page, 'focus'), 900);
          const custom = page.locator('.atm-presets button[aria-expanded]');
          await tap(page, custom, 600);
          const minutes = page.locator('#mono-focus-custom');
          await tap(page, minutes, 200);
          await minutes.pressSequentially('50', { delay: 120 * SLOW });
          await pause(300);
          await tap(page, page.locator('form:has(#mono-focus-custom) button[type="submit"]'), 900);
          await tap(page, startButton(page), 3500);
        },
      );
    });

    clip('c11', async (page) => {
      await record(
        page,
        `${lang}-c11-telefon`,
        async () => {
          await nav(page, 'focus').click();
          await pause(600);
        },
        async () => {
          await pause(900);
          await tap(page, preset(page, 45), 900);
          await tap(page, startButton(page), 1800);
          await fastForward(page);
          await pause(4000);
        },
      );
    });

    clip('c07', async (page) => {
      await record(
        page,
        `${lang}-c07-ai`,
        async () => {
          await nav(page, 'more').click();
          await pause(500);
          await page.locator('.mono-more-item').first().click();
          await pause(800);
          const goal = page.locator('textarea.mono-field').first();
          await goal.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await pause(400);
          await page.evaluate(() => window.scrollBy(0, -120));
        },
        async () => {
          const goal = page.locator('textarea.mono-field').first();
          await tap(page, goal, 300);
          await goal.pressSequentially(GOAL[lang], { delay: 60 * SLOW });
          await pause(600);
          const panel = page.locator('.mono-item:has(> textarea.mono-field)').first();
          await tap(page, panel.locator('.mono-btn-primary').first(), 1500);
          await glide(page, 220, 1200);
          await pause(1800);
          await tap(page, panel.locator('.mono-note:has(ul) .mono-btn-primary'), 2200);
          await pause(1500);
        },
      );
    });

    clip('c12', async (page) => {
      await record(
        page,
        `${lang}-c12-raport`,
        async () => {
          await seedApp(page, lang, { template: 'thesis', week: true });
        },
        async () => {
          await pause(600);
          await tap(page, nav(page, 'reports'), 1800);
          await glide(page, 300, 1800);
          await pause(1400);
          await glide(page, 360, 1800);
          await pause(1600);
          await glide(page, 360, 1800);
          await pause(2000);
        },
      );
    });

    // Habit ticks outside the Today priorities list.
    const habitTicks = (page: Page) =>
      page.locator('.mono-list-row:not(.mono-azi-prio .mono-list-row) .mono-tick');

    clip('c05', async (page) => {
      await record(
        page,
        `${lang}-c05-somn`,
        async () => {
          await seedApp(page, lang, { template: 'sleep', habitDays: 6 });
          await nav(page, 'projects').click();
          await pause(600);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        async () => {
          await pause(1500);
          await tap(page, nav(page, 'today'), 1000);
          const first = habitTicks(page).first();
          const dy = await first.evaluate((el) => el.getBoundingClientRect().top - 230);
          await glide(page, dy, 1300);
          await pause(1200);
          await tap(page, first, 1800);
          await tap(page, habitTicks(page).nth(1), 2600);
        },
      );
    });

    clip('c09', async (page) => {
      await record(
        page,
        `${lang}-c09-xp`,
        async () => {
          await seedApp(page, lang, { nearRank: true });
        },
        async () => {
          await pause(800);
          await tap(page, preset(page, 45), 800);
          await tap(page, startButton(page), 1200);
          await fastForward(page);
          await pause(4500);
          await closeSessionEnd(page);
          await tap(page, nav(page, 'more'), 900);
          await tap(page, page.locator('.mono-more-item').nth(1), 1800);
          await glide(page, 260, 1500);
          await pause(2500);
        },
      );
    });

    clip('c14', async (page) => {
      await record(
        page,
        `${lang}-c14-test-maine`,
        async () => {
          await nav(page, 'today').click();
          await pause(800);
        },
        async () => {
          const input = page.locator('.mono-azi-prio input').first();
          for (const text of TEST_TASKS[lang]) {
            await tap(page, input, 250);
            await input.pressSequentially(text, { delay: 45 * SLOW });
            await pause(200);
            await input.press('Enter');
            await pause(500);
          }
          await tap(page, nav(page, 'focus'), 800);
          await tap(page, preset(page, 45), 700);
          await tap(page, startButton(page), 1000);
          await fastForward(page);
          await pause(2500);
          await closeSessionEnd(page);
          await tap(page, nav(page, 'today'), 900);
          const rows = page.locator('.mono-azi-prio .mono-list-row');
          for (let i = 0; i < 3; i++) await tap(page, rows.nth(i).locator('button').first(), 700);
          await pause(2200);
        },
      );
    });

    clip('c10', async (page) => {
      await record(
        page,
        `${lang}-c10-zi`,
        async () => {
          await seedApp(page, lang, { template: 'exam' });
          await nav(page, 'today').click();
          await pause(800);
          await page.evaluate(() => window.scrollTo(0, 0));
        },
        async () => {
          const rituals = page.locator('.mono-azi-rituals .mono-azi-ritual');
          // Morning: keep today's proposals, then the three that matter.
          await tap(page, rituals.nth(0), 1300);
          const dialog = page.locator('.backdrop-fade.fixed');
          for (let i = 0; i < 6 && (await dialog.locator('button').count()) === 7; i++) {
            await tap(page, dialog.locator('button').first(), 800);
          }
          for (let i = 0; i < 4 && (await dialog.count()) > 0; i++) {
            await tap(page, dialog.locator('button').last(), i === 1 ? 1600 : 1000);
          }
          // Day: a focus block, time-lapsed.
          await tap(page, nav(page, 'focus'), 800);
          await tap(page, preset(page, 45), 600);
          await tap(page, startButton(page), 900);
          await fastForward(page);
          await pause(2200);
          await closeSessionEnd(page);
          // Evening: tick what got done, close the day.
          await tap(page, nav(page, 'today'), 900);
          await page.evaluate(() => window.scrollTo(0, 0));
          await tap(page, page.locator('.mono-azi-prio .mono-list-row button').first(), 900);
          await tap(page, rituals.nth(1), 3500);
        },
      );
    });
  });
}
