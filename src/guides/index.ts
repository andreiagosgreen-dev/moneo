import { en } from './content/en';
import { ro } from './content/ro';
import { ru } from './content/ru';
import type { Guide, GuideId, GuideLocale, GuideUi } from './types';

export type { Guide, GuideId, GuideLocale } from './types';
export { GUIDE_BASE, GUIDE_LOCALES, guidePath, hasGuides } from './paths';

export const GUIDES: Record<GuideLocale, readonly Guide[]> = { en, ro, ru };

export function findGuide(locale: GuideLocale, id: GuideId): Guide | undefined {
  return GUIDES[locale].find((g) => g.id === id);
}

export const GUIDE_UI: Record<GuideLocale, GuideUi> = {
  en: {
    section: 'Guides',
    indexTitle: 'Guides: stop putting it off and finish what you start — Moneo',
    indexDescription:
      'Short, practical guides for students: beat procrastination, use Pomodoro, plan your week, write a thesis, study for an exam.',
    indexH1: 'Guides: finish what you start',
    indexIntro:
      'Short, practical guides for students and anyone who keeps postponing: one idea per guide, steps you can use today.',
    readMin: '{n} min read',
    openApp: 'Open Moneo',
    ctaTitle: 'Try it in Moneo',
    ctaButton: 'Start free, no account',
    related: 'More guides',
    alsoIn: 'Also in',
    terms: 'Terms',
    privacy: 'Privacy',
    languageName: 'English',
  },
  ro: {
    section: 'Ghiduri',
    indexTitle: 'Ghiduri: gata cu amânarea, termină ce ai început — Moneo',
    indexDescription:
      'Ghiduri scurte și practice pentru studenți: cum nu mai amâni, Pomodoro, planul săptămânii, licența, examenul de mâine.',
    indexH1: 'Ghiduri: termină ce ai început',
    indexIntro:
      'Ghiduri scurte și practice pentru studenți și pentru oricine tot amână: o idee pe ghid, pași pe care îi poți folosi azi.',
    readMin: '{n} min de citit',
    openApp: 'Deschide Moneo',
    ctaTitle: 'Încearcă în Moneo',
    ctaButton: 'Începe gratuit, fără cont',
    related: 'Alte ghiduri',
    alsoIn: 'Și în',
    terms: 'Termeni',
    privacy: 'Confidențialitate',
    languageName: 'Română',
  },
  ru: {
    section: 'Статьи',
    indexTitle: 'Статьи: хватит откладывать, доводи начатое до конца — Moneo',
    indexDescription:
      'Короткие практичные статьи для студентов: как перестать откладывать, помодоро, план недели, диплом, экзамен завтра.',
    indexH1: 'Статьи: доводи начатое до конца',
    indexIntro:
      'Короткие практичные статьи для студентов и всех, кто откладывает: одна идея на статью и шаги, которые можно применить уже сегодня.',
    readMin: '{n} мин чтения',
    openApp: 'Открыть Moneo',
    ctaTitle: 'Попробуй в Moneo',
    ctaButton: 'Начать бесплатно, без аккаунта',
    related: 'Другие статьи',
    alsoIn: 'Также на',
    terms: 'Условия',
    privacy: 'Конфиденциальность',
    languageName: 'Русский',
  },
};
