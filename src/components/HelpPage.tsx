import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const SECTIONS: Array<{ titleKey: TKey; bodyKey: TKey }> = [
  { titleKey: 'help.s.timer.t', bodyKey: 'help.s.timer.b' },
  { titleKey: 'help.s.today.t', bodyKey: 'help.s.today.b' },
  { titleKey: 'help.s.calendar.t', bodyKey: 'help.s.calendar.b' },
  { titleKey: 'help.s.projects.t', bodyKey: 'help.s.projects.b' },
  { titleKey: 'help.s.agile.t', bodyKey: 'help.s.agile.b' },
  { titleKey: 'help.s.goals.t', bodyKey: 'help.s.goals.b' },
  { titleKey: 'help.s.aipath.t', bodyKey: 'help.s.aipath.b' },
  { titleKey: 'help.s.assistant.t', bodyKey: 'help.s.assistant.b' },
  { titleKey: 'help.s.reports.t', bodyKey: 'help.s.reports.b' },
  { titleKey: 'help.s.lifemap.t', bodyKey: 'help.s.lifemap.b' },
  { titleKey: 'help.s.life.t', bodyKey: 'help.s.life.b' },
  { titleKey: 'help.s.skills.t', bodyKey: 'help.s.skills.b' },
  { titleKey: 'help.s.privacy.t', bodyKey: 'help.s.privacy.b' },
];

export default function HelpPage() {
  const { t } = useI18n();
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 pb-10 pt-10 sm:px-6">
      <Link to="/" className="press font-mono text-[12px] text-sage hover:text-cream">
        {t('help.back')}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-cream">
        {t('help.title')}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-sage">{t('help.sub')}</p>
      <div className="mt-6 space-y-3">
        {SECTIONS.map((s) => (
          <section
            key={s.titleKey}
            className="rounded-xl bg-ink/40 px-5 py-4 ring-1 ring-inset ring-line"
          >
            <h2 className="font-display text-[16px] font-bold text-cream">{t(s.titleKey)}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-sage">{t(s.bodyKey)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
