import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';

/*
 * The app parts of the week-1 clips (marketing/05-kit-saptamana-1.md in the
 * owner's folder), recorded from the real app in each language. Steps use
 * language-independent selectors; the pace is a calm human one, and a soft
 * circle shows every tap like a phone's "show touches".
 *
 * CLIP_LANGS=ro,ru,en and CLIPS=c02,c04,c03,c15 pick what to record.
 */

type Lang = 'ro' | 'ru' | 'en';
const LANGS = (process.env.CLIP_LANGS ?? 'ro,ru,en')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is Lang => s === 'ro' || s === 'ru' || s === 'en');
const CLIPS = (process.env.CLIPS ?? 'c02,c04,c03,c15').split(',').map((s) => s.trim());

const TODAY_TASKS: Record<Lang, string[]> = {
  ro: ['Recapitulez capitolul 2', 'Trimit tema la statistică', 'Sun la bibliotecă'],
  ru: ['Повторить главу 2', 'Сдать задание по статистике', 'Позвонить в библиотеку'],
  en: ['Review chapter 2', 'Send the statistics homework', 'Call the library'],
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
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await pause(900);
  await tap(page, card.locator('button').first(), 600);
  await tap(page, card.locator('.mono-btn-primary'), after);
}

/**
 * Records one clip. Playwright's own video is captured at CSS-pixel size
 * (360×640), so the frames come straight from Chrome's screencast at full
 * device resolution instead. Only `play` is recorded.
 */
async function record(
  page: Page,
  name: string,
  setup: () => Promise<void>,
  play: () => Promise<void>,
): Promise<void> {
  await page.goto('/');
  await nav(page, 'focus').waitFor();
  await setup();
  await pause(600);

  const dir = join(FRAMES_DIR, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: { file: string; t: number }[] = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (f) => {
    const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1080,
    maxHeight: 1920,
  });
  await play();
  await pause(800);
  await cdp.send('Page.stopScreencast');
  const end = Date.now() / 1000;
  if (frames.length === 0) throw new Error(`no frames for ${name}`);

  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(3)}`);
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
            await input.pressSequentially(text, { delay: 55 });
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
  });
}
