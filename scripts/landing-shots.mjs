/**
 * Captures the real app screens shown on the landing page (Focus, Today,
 * the habit month grid, the week planner and Growth with the rank card) with
 * believable demo data, in Romanian and English, and writes optimized
 * AVIF + WebP variants plus the header mark.
 *
 * Outputs (public/landing/):
 *   mark-64.webp
 *   <ro|en>/{focus,today,habits,week}-desktop-{960,1440}.{avif,webp}
 *   <ro|en>/{focus,today,habits,week,growth}-phone-{360,720}.{avif,webp}
 *
 * Needs the dev server: `npm run dev`, then `node scripts/landing-shots.mjs`
 * (override the URL with LANDING_SHOTS_URL and the browser binary with
 * LANDING_SHOTS_CHROME).
 */

/* global window, document, localStorage, sessionStorage -- used inside page.evaluate / init scripts */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'landing');
const BASE = process.env.LANDING_SHOTS_URL ?? 'http://localhost:3000';
const DAY = 86_400_000;

const COPY = {
  ro: {
    tabs: {
      today: 'Azi',
      schedule: 'Orar',
      growth: 'Creștere',
      more: 'Mai mult',
      priorities: 'Priorități',
      habitView: 'Vizualizare obiceiuri',
      month: 'Lună',
      week: 'Săptămâna',
    },
    projects: [
      { id: 'p-thesis', name: 'Lucrare de licență', color: '#c4926a', category: 'learning' },
      { id: 'p-english', name: 'Engleză B2', color: '#7fa37a', category: 'learning' },
      { id: 'p-site', name: 'Site portofoliu', color: '#8a9bb5', category: 'work' },
    ],
    tasks: [
      ['t1', 'p-thesis', 'Capitolul 2 — recenzia literaturii'],
      ['t2', 'p-thesis', 'Rezumă 3 articole științifice'],
      ['t3', 'p-thesis', 'Schița metodologiei'],
      ['t4', 'p-english', 'Lecția 7 — ascultare și vocabular'],
      ['t5', 'p-site', 'Pagina de proiecte'],
      ['t6', 'p-thesis', 'Bibliografie în format APA'],
      ['t7', 'p-english', 'Eseu de 250 de cuvinte'],
      ['t8', 'p-site', 'Alege fonturile și culorile'],
    ],
    habits: ['Citit 20 de minute', 'Mișcare', 'Fără telefon după 22:00'],
  },
  en: {
    tabs: {
      today: 'Today',
      schedule: 'Schedule',
      growth: 'Growth',
      more: 'More',
      priorities: 'Priorities',
      habitView: 'Habit view',
      month: 'Month',
      week: 'This week',
    },
    projects: [
      { id: 'p-thesis', name: 'Final thesis', color: '#c4926a', category: 'learning' },
      { id: 'p-english', name: 'Spanish B1', color: '#7fa37a', category: 'learning' },
      { id: 'p-site', name: 'Portfolio site', color: '#8a9bb5', category: 'work' },
    ],
    tasks: [
      ['t1', 'p-thesis', 'Chapter 2 — literature review'],
      ['t2', 'p-thesis', 'Summarize 3 research papers'],
      ['t3', 'p-thesis', 'Draft the methodology'],
      ['t4', 'p-english', 'Lesson 7 — listening and vocabulary'],
      ['t5', 'p-site', 'Projects page'],
      ['t6', 'p-thesis', 'Bibliography in APA style'],
      ['t7', 'p-english', 'Write a 250-word essay'],
      ['t8', 'p-site', 'Pick fonts and colors'],
    ],
    habits: ['Read 20 minutes', 'Move your body', 'No phone after 10 pm'],
  },
};

const dayKey = (at) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Three weeks of steady work: ≈ Apprentice II with a visible streak. */
function demoStorage(lang) {
  const c = COPY[lang];
  const now = Date.now();
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const morning = today.getTime();

  const projects = c.projects.map((p, i) => ({
    ...p,
    tags: [],
    createdAt: now - (30 - i) * DAY,
    updatedAt: now - DAY,
  }));

  const doneDaysAgo = { t2: 3, t6: 6, t8: 9, t1: 0 };
  const dueInDays = { t3: 2, t5: 4, t7: 1 };
  const tasks = c.tasks.map(([id, projectId, title], i) => {
    const ago = doneDaysAgo[id];
    const done = ago !== undefined;
    const due = dueInDays[id];
    return {
      id,
      projectId,
      title,
      status: done ? 'completed' : i === 2 ? 'in_progress' : 'pending',
      priority: i < 3 ? 'p1' : 'p2',
      createdAt: now - 20 * DAY,
      updatedAt: now - (done ? ago : 1) * DAY,
      ...(done ? { completedAt: ago === 0 ? morning + 50 * 60_000 : now - ago * DAY } : {}),
      ...(due !== undefined ? { dueAt: morning + due * DAY + 8 * 3_600_000 } : {}),
    };
  });

  const history = [];
  const pattern = [
    75, 50, 75, 100, 50, 75, 0, 75, 100, 50, 75, 75, 50, 0, 100, 75, 75, 50, 100, 75,
  ];
  pattern.forEach((minutes, idx) => {
    const ago = pattern.length - idx;
    let left = minutes;
    let k = 0;
    while (left > 0) {
      const min = Math.min(25, left);
      history.push({
        id: `s-${ago}-${k}`,
        at: now - ago * DAY + k * 35 * 60_000,
        min,
        projectId: c.projects[k % 2 === 0 ? 0 : 1 + (ago % 2)].id,
      });
      left -= min;
      k++;
    }
  });
  history.push(
    { id: 's-today-0', at: morning + 25 * 60_000, min: 25, projectId: 'p-thesis', taskId: 't1' },
    { id: 's-today-1', at: morning + 55 * 60_000, min: 25, projectId: 'p-thesis', taskId: 't1' },
  );

  const habits = c.habits.map((name, i) => ({
    id: `h${i}`,
    name,
    frequency: 'daily',
    targetPerWeek: 7,
    createdAt: now - 21 * DAY,
    updatedAt: now - DAY,
  }));
  const habitLog = {};
  habits.forEach((h, i) => {
    const days = [];
    for (let ago = 1; ago <= 18; ago++)
      if ((ago + i) % (i + 3) !== 0) days.push(dayKey(now - ago * DAY));
    if (i === 0) days.push(dayKey(now));
    habitLog[h.id] = days;
  });

  const pastPlan = (ago, doneCount) => ({
    dateKey: dayKey(now - ago * DAY),
    tasks: [c.tasks[5], c.tasks[6], c.tasks[7]].map(([taskId, , text], i) => ({
      id: `i-${ago}-${i}`,
      text,
      done: i < doneCount,
      rank: i + 1,
      estimateMin: 25,
      taskId,
    })),
  });
  const ivyPlans = [
    pastPlan(3, 3),
    pastPlan(2, 2),
    pastPlan(1, 3),
    {
      dateKey: dayKey(now),
      tasks: [
        { id: 'i1', text: c.tasks[0][2], done: true, rank: 1, estimateMin: 50, taskId: 't1' },
        { id: 'i2', text: c.tasks[2][2], done: false, rank: 2, estimateMin: 50, taskId: 't3' },
        { id: 'i3', text: c.tasks[3][2], done: false, rank: 3, estimateMin: 25, taskId: 't4' },
      ],
    },
  ];
  const energyLog = [{ id: `daily-${dayKey(now)}`, at: morning, level: 8, mood: 4, daily: true }];

  return {
    'moneo:locale': lang,
    'moneo:landing-seen': true,
    'moneo:onboarding-seen': true,
    'moneo:ritual-day': dayKey(now),
    'moneo:xp-seen': { level: 99 },
    'moneo:projects': projects,
    'moneo:selected-project': 'p-thesis',
    'moneo:tasks': tasks,
    'solanum:history': history,
    'moneo:habits': habits,
    'moneo:habit-log': habitLog,
    'moneo:ivy-plans': ivyPlans,
    'moneo:energy-log': energyLog,
  };
}

async function newPage(browser, lang, viewport, deviceScaleFactor, isMobile) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    isMobile,
    hasTouch: isMobile,
    locale: lang === 'ro' ? 'ro-RO' : 'en-US',
    reducedMotion: 'reduce',
  });
  const seed = demoStorage(lang);
  await context.addInitScript((entries) => {
    if (sessionStorage.getItem('shots:seeded')) return;
    sessionStorage.setItem('shots:seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
  const page = await context.newPage();
  await page.goto(BASE + '/');
  await page.locator('.atm-time').first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

/** Hides the first-run coach cards so the screen shows the real work. */
async function settle(page) {
  const coach = page.locator('.mono-coach .mono-coach-dismiss:visible');
  while ((await coach.count()) > 0) await coach.first().click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

async function writeVariants(png, lang, id, widths) {
  for (const w of widths) {
    const base = join(OUT, lang, `${id}-${w}`);
    const resized = sharp(png).resize({ width: w });
    await resized.clone().avif({ quality: 55, effort: 6 }).toFile(`${base}.avif`);
    await resized.clone().webp({ quality: 80, effort: 6 }).toFile(`${base}.webp`);
    console.log(`✓ ${lang}/${id}-${w}.{avif,webp}`);
  }
}

async function openTab(page, name, mobileMore) {
  if (mobileMore) {
    await page.getByRole('tab', { name: mobileMore, exact: true }).click();
    await page.locator('.mono-more-item', { hasText: name }).first().click();
  } else {
    await page.getByRole('tab', { name, exact: true }).first().click();
  }
}

async function dismissRecap(page) {
  const close = page.locator('.mono-recap-close:visible');
  if ((await close.count()) > 0) await close.first().click();
}

async function openHabitMonth(page, tabs) {
  await openTab(page, tabs.today);
  await dismissRecap(page);
  await page
    .getByRole('group', { name: tabs.habitView })
    .getByRole('button', { name: tabs.month })
    .click();
  const grid = page.getByRole('grid').first();
  await grid.waitFor();
  await settle(page);
  await grid.evaluate((el) => {
    const top = el.closest('section') ?? el;
    window.scrollTo(0, top.getBoundingClientRect().top + window.scrollY - 20);
  });
  await page.waitForTimeout(300);
}

async function openWeek(page, tabs) {
  await openTab(page, tabs.schedule);
  const week = page.getByRole('region', { name: tabs.week }).first();
  await week.waitFor();
  await settle(page);
  await week.evaluate((el) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
  });
  await page.waitForTimeout(300);
}

await mkdir(join(OUT, 'ro'), { recursive: true });
await mkdir(join(OUT, 'en'), { recursive: true });

await sharp(join(here, '..', 'public', 'brand', 'moneo-mark-1200.png'))
  .resize(64, 64)
  .webp({ quality: 90 })
  .toFile(join(OUT, 'mark-64.webp'));
console.log('✓ mark-64.webp');

const browser = await chromium.launch({ executablePath: process.env.LANDING_SHOTS_CHROME });
try {
  for (const lang of ['ro', 'en']) {
    const tabs = COPY[lang].tabs;

    const desk = await newPage(browser, lang, { width: 1440, height: 900 }, 1, false);
    await settle(desk.page);
    await writeVariants(await desk.page.screenshot(), lang, 'focus-desktop', [960, 1440]);

    await openTab(desk.page, tabs.today);
    await dismissRecap(desk.page);
    await settle(desk.page);
    await writeVariants(await desk.page.screenshot(), lang, 'today-desktop', [960, 1440]);

    await openHabitMonth(desk.page, tabs);
    await writeVariants(await desk.page.screenshot(), lang, 'habits-desktop', [960, 1440]);

    await openWeek(desk.page, tabs);
    await writeVariants(await desk.page.screenshot(), lang, 'week-desktop', [960, 1440]);
    await desk.context.close();

    const phone = await newPage(browser, lang, { width: 360, height: 779 }, 2, true);
    await settle(phone.page);
    await writeVariants(await phone.page.screenshot(), lang, 'focus-phone', [360, 720]);

    await openTab(phone.page, tabs.today);
    await dismissRecap(phone.page);
    await settle(phone.page);
    await phone.page
      .getByText(tabs.priorities, { exact: true })
      .first()
      .evaluate((el) => {
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
      });
    await phone.page.waitForTimeout(300);
    await writeVariants(await phone.page.screenshot(), lang, 'today-phone', [360, 720]);

    await openHabitMonth(phone.page, tabs);
    await writeVariants(await phone.page.screenshot(), lang, 'habits-phone', [360, 720]);

    await openWeek(phone.page, tabs);
    await writeVariants(await phone.page.screenshot(), lang, 'week-phone', [360, 720]);

    await openTab(phone.page, tabs.growth, tabs.more);
    await phone.page.getByTestId('rank-card').waitFor();
    await settle(phone.page);
    await writeVariants(await phone.page.screenshot(), lang, 'growth-phone', [360, 720]);
    await phone.context.close();
  }
} finally {
  await browser.close();
}
