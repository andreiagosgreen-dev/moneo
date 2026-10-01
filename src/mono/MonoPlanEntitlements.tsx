import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import { getEntitlements } from '../lib/billing/entitlements';
import { PRO_PRICES, type ComparisonValue } from '../lib/billing/pricingConfig';

export type CurrentPlan = 'free' | 'pro-monthly' | 'pro-yearly' | 'pro-gift';

interface Props {
  current: CurrentPlan;
  /** Paid access end for a cancelled subscription (epoch ms), else null. */
  activeUntil?: number | null;
}

const PLAN_NAME: Record<CurrentPlan, TKey> = {
  free: 'pricing.plan.free.name',
  'pro-monthly': 'pricing.plan.proMonthly.name',
  'pro-yearly': 'pricing.plan.proYearly.name',
  'pro-gift': 'plan.ent.gift',
};

/** Settings → Plan: what Free, Pro monthly and Pro yearly each unlock, by area. */
export default function MonoPlanEntitlements({ current, activeUntil = null }: Props) {
  const { t, fmtNum, tag } = useI18n();
  const areas = getEntitlements();
  const isPro = current !== 'free';

  const value = (v: ComparisonValue) => {
    if (v.kind === 'check') return <span aria-label={t('plan.ent.yes')}>✓</span>;
    if (v.kind === 'dash') return <span aria-label={t('plan.ent.no')}>—</span>;
    if (v.kind === 'limit') return fmtNum(v.value);
    return t(v.key);
  };

  return (
    <section className="mono-ent" aria-labelledby="mono-ent-title" data-testid="plan-entitlements">
      <h3 className="mono-h3" id="mono-ent-title">
        {t('plan.ent.title')}
      </h3>
      <p className="mono-meta mono-ent-current" data-testid="plan-current">
        {t('plan.ent.yours', { plan: t(PLAN_NAME[current]) })}
        {activeUntil
          ? ` · ${t('plan.ent.until', {
              date: new Date(activeUntil).toLocaleDateString(tag, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}`
          : ''}
      </p>

      <ul className="mono-ent-plans">
        <li className={current === 'free' ? 'is-current' : undefined}>
          <strong>{t('pricing.plan.free.name')}</strong>
          <span>{t('plan.ent.freeSum')}</span>
        </li>
        <li className={current === 'pro-monthly' ? 'is-current' : undefined}>
          <strong>
            {t('pricing.plan.proMonthly.name')} · {PRO_PRICES.monthly}
            {t('pay.perMonth')}
          </strong>
          <span>{t('plan.ent.proSum')}</span>
        </li>
        <li className={current === 'pro-yearly' ? 'is-current' : undefined}>
          <strong>
            {t('pricing.plan.proYearly.name')} · {PRO_PRICES.yearly}
            {t('pay.perYear')}
          </strong>
          <span>
            {t('plan.ent.yearlySum', {
              price: PRO_PRICES.yearlyMonthly,
              n: fmtNum(PRO_PRICES.monthsFree),
            })}
          </span>
        </li>
      </ul>

      <div className="mono-ent-table" role="table" aria-label={t('plan.ent.title')}>
        <div className="mono-ent-row mono-ent-head" role="row">
          <span role="columnheader">{t('plan.ent.feature')}</span>
          <span role="columnheader" className={!isPro ? 'is-current' : undefined}>
            {t('pricing.plan.free.name')}
          </span>
          <span role="columnheader" className={isPro ? 'is-current' : undefined}>
            {t('plan.ent.proCol')}
          </span>
        </div>
        {areas.map((area) => (
          <div key={area.id} role="rowgroup" data-area={area.id}>
            <p className="mono-eyebrow mono-ent-area" role="row">
              <span role="rowheader">{t(area.titleKey)}</span>
            </p>
            {area.rows.map((row) => (
              <div key={row.labelKey} className="mono-ent-row" role="row">
                <span role="rowheader">{t(row.labelKey, row.labelVars)}</span>
                <span role="cell">{value(row.free)}</span>
                <span role="cell">{value(row.pro)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mono-meta mono-ent-note">{t('plan.ent.note')}</p>
    </section>
  );
}
