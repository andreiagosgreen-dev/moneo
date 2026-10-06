/** Static SEO guides (built by scripts/prerender-landing.mjs, no SPA). */

export type GuideLocale = 'en' | 'ro' | 'ru';

export type GuideId = 'procrastination' | 'pomodoro' | 'thesis' | 'exam-tomorrow' | 'plan-week';

export interface Guide {
  id: GuideId;
  /** URL slug in the guide's language (latin letters, digits, dashes). */
  slug: string;
  /** <title> and Article headline. */
  title: string;
  /** Meta description, 70–160 characters. */
  description: string;
  h1: string;
  /** Mini-markdown (see markdown.ts). */
  body: string;
  /** One or two sentences: how Moneo helps with exactly this. */
  cta: string;
}

export interface GuideUi {
  /** Short label for the section ("Guides"). */
  section: string;
  indexTitle: string;
  indexDescription: string;
  indexH1: string;
  indexIntro: string;
  /** "{n} min read". */
  readMin: string;
  openApp: string;
  ctaTitle: string;
  ctaButton: string;
  related: string;
  alsoIn: string;
  terms: string;
  privacy: string;
  languageName: string;
}
