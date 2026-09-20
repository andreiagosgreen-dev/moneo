import { useState } from 'react';
import type { LifeCardProps, LifeTab } from './life/types';
import { LIFE_TABS } from './life/types';
import HabitsTab from './life/HabitsTab';
import BalanceTab from './life/BalanceTab';
import JournalTab from './life/JournalTab';
import EnergyTab from './life/EnergyTab';
import { useI18n } from '../lib/i18n/LocaleContext';

export default function LifeCard(props: LifeCardProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<LifeTab>('habits');

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('life.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('life.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {t('life.subtitle')}
          </p>
        </div>
      </header>

      <div className="mt-4 flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line w-fit">
        {LIFE_TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`press rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              tab === tb.id ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
            }`}
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'habits' && <HabitsTab {...props} />}
        {tab === 'balance' && <BalanceTab {...props} />}
        {tab === 'journal' && <JournalTab {...props} />}
        {tab === 'energy' && <EnergyTab {...props} />}
      </div>
    </section>
  );
}
