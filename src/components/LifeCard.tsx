import { useState } from 'react';
import type { LifeCardProps, LifeTab } from './life/types';
import { LIFE_TABS } from './life/types';
import HabitsTab from './life/HabitsTab';
import BalanceTab from './life/BalanceTab';
import JournalTab from './life/JournalTab';
import EnergyTab from './life/EnergyTab';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

export default function LifeCard(props: LifeCardProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<LifeTab>('habits');

  return (
    <section
      className="card flex h-full min-w-0 flex-col px-5 py-5 sm:px-6"
      aria-label={t('life.aria')}
    >
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('life.title')}
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-sage">{t('life.sub')}</p>
        </div>
      </header>

      <div className="mt-3 flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-ink/60 p-1 ring-1 ring-line">
        {LIFE_TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`press shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              tab === tb.id ? 'bg-cream/10 text-cream' : 'text-sage hover:text-cream'
            }`}
          >
            {t(tb.label as TKey)}
          </button>
        ))}
      </div>

      <div className="mt-4 min-w-0 flex-1">
        {tab === 'habits' && <HabitsTab {...props} />}
        {tab === 'balance' && <BalanceTab {...props} />}
        {tab === 'journal' && <JournalTab {...props} />}
        {tab === 'energy' && <EnergyTab {...props} />}
      </div>
    </section>
  );
}
