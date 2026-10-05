import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';

/*
 * The app parts of the short videos (the owner's marketing kit: week 1 is
 * C02 C04 C03 C15, week 2 is C06 C11 C07 C12), recorded from the real app in
 * each language. Steps use
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
const ALL_CLIPS = 'c02,c04,c03,c15,c06,c11,c07,c12';
const CLIPS = (process.env.CLIPS || ALL_CLIPS).split(',').map((s) => s.trim());
const SLOW = Math.max(1, Number(process.env.CLIP_SLOW ?? 3) || 1);

const TODAY_TASKS: Record<Lang, string[]> = {
  ro: ['Recapitulez capitolul 2', 'Trimit tema la statistică', 'Sun la bibliotecă'],
  ru: ['Повторить главу 2', 'Сдать задание по статистике', 'Позвонить в библиотеку'],
  en: ['Review chapter 2', 'Send the statistics homework', 'Call the library'],
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

/**
 * A student's thesis project (the Pro "Write your thesis" system, built with
 * the app's own code) and, with `week`, seven days of focus on it. The
 * recorder has no account, so this stands in for a Pro trial user's data.
 */
async function seedThesis(page: Page, lang: Lang, week: boolean): Promise<void> {
  const script = `(async () => {
    const lang = ${JSON.stringify(lang)};
    const week = ${JSON.stringify(week)};
    const L = await import('/src/lib/lifeTemplates.ts');
    const I = await import('/src/lib/i18n/index.ts');
    const K = (await import('/src/lib/storage/storageKeys.ts')).STORAGE_KEYS;
    const i18n = I.createI18n(lang, await I.loadDictionary(lang));
    const now = Date.now();
    const r = L.instantiateLifeTemplate(L.getLifeTemplate('thesis'), {
      t: i18n.t, now, isPro: true, existingActiveHabits: 0,
    });
    const read = (k) => JSON.parse(localStorage.getItem(k) || '[]');
    const tasks = r.tasks.map((t, i) =>
      week && i < 2 ? { ...t, status: 'completed', completedAt: now - (5 - i * 2) * 864e5 } : t);
    localStorage.setItem(K.projects, JSON.stringify([...read(K.projects), r.project]));
    localStorage.setItem(K.tasks, JSON.stringify([...read(K.tasks), ...tasks]));
    localStorage.setItem(K.habits, JSON.stringify([...read(K.habits), ...r.habits]));
    if (!week) return;
    const day = 864e5;
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const plan = [[25, 25, 45], [45, 45, 25], [], [25, 45, 45, 25], [25], [45, 45, 45], [25, 50]];
    const history = [];
    plan.forEach((mins, i) => {
      const base = midnight.getTime() - (6 - i) * day;
      mins.forEach((min, j) => {
        let at = base + (9 + j * 2) * 36e5;
        if (i === 6) at = now - (mins.length - j) * 90 * 6e4;
        history.push({ id: 'rec-' + i + '-' + j, at, min, projectId: r.project.id });
      });
    });
    localStorage.setItem(K.history, JSON.stringify(history));
  })()`;
  await page.evaluate(script);
  await page.reload();
  await nav(page, 'focus').waitFor();
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
  const capture = (async () => {
    while (recording) {
      const t = Date.now() / 1000;
      const { result } = await cdp.send('Runtime.evaluate', {
        expression: '[visualViewport.pageLeft, visualViewport.pageTop]',
        returnByValue: true,
      });
      const [x, y] = result.value as [number, number];
      // Headless Chrome captures CSS pixels; the clip scale renders at 3×.
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 90,
        optimizeForSpeed: true,
        clip: { x, y, width: 360, height: 640, scale: 3 },
      });
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
          await seedThesis(page, lang, false);
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
          await glide(page, 200, 1200);
          await pause(1600);
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
          // Time-lapse: 45 minutes in about 4 seconds.
          await speed(page, 700);
          await pause(4000);
          await speed(page, 1);
          await pause(3500);
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
          await seedThesis(page, lang, true);
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
  });
}
