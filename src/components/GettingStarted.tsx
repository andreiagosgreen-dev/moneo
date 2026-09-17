import type { NavTab } from './TopNav';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  onGo: (t: NavTab) => void;
}

const STEPS: Array<{ n: string; title: TKey; body: TKey; cta: TKey; tab: NavTab }> = [
  { n: '1', title: 'getting.s1t', body: 'getting.s1b', cta: 'getting.s1c', tab: 'focus' },
  { n: '2', title: 'getting.s2t', body: 'getting.s2b', cta: 'getting.s2c', tab: 'today' },
  { n: '3', title: 'getting.s3t', body: 'getting.s3b', cta: 'getting.s3c', tab: 'reports' },
];

/** First-run guide, shown only while the workspace is still empty. */
export default function GettingStarted({ onGo }: Props) {
  const { t } = useI18n();
  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('getting.kicker')}>
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t('getting.kicker')}
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">
          {t('getting.headline')}
        </h2>
      </header>
      <ol className="mt-4 space-y-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex items-start gap-3 rounded-xl bg-ink/40 px-4 py-3 ring-1 ring-inset ring-line"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-bold text-on-accent"
              style={{ background: 'var(--accent)' }}
            >
              {s.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-cream">{t(s.title)}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-sage">{t(s.body)}</p>
            </div>
            <button
              onClick={() => onGo(s.tab)}
              className="press btn-ghost shrink-0 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold"
            >
              {t(s.cta)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
