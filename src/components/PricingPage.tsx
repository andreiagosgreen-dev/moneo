import { Link } from 'react-router-dom';
import { useAuth } from '../lib/authProvider';
import { initiateCheckout, type Plan } from '../lib/billing/lemonSqueezy';
import {
  PRICING_PLANS_DISPLAY,
  PRO_PRICES,
  SYNC_NOTE_KEY,
  SYNC_SCOPE_KEY,
  getComparisonRows,
  type ComparisonValue,
} from '../lib/billing/pricingConfig';
import { useI18n } from '../lib/i18n/LocaleContext';
import { openExternal } from '../lib/links';
import ManageSubscriptionButton from './ManageSubscriptionButton';

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-accent"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function renderValue(v: ComparisonValue): string {
  if (v.kind === 'check') return '✓';
  if (v.kind === 'dash') return '—';
  if (v.kind === 'limit') return String(v.value);
  return '';
}

/**
 * Public pricing page: Free vs Pro comparison. Every price, limit and
 * feature string comes from pricingConfig + i18n — no hardcoded copy.
 * Local-first: fully readable without an account.
 */
export default function PricingPage() {
  const { t } = useI18n();
  const auth = useAuth();
  const rows = getComparisonRows();
  const currentPlan: Plan = auth.isPro ? (auth.subscription.planId as Plan) : 'free';
  const showManage = auth.subscription.planId !== 'free';

  const handleSubscribe = (planId: Plan) => {
    if (!auth.user) {
      alert(t('pay.signin'));
      return;
    }
    const url = initiateCheckout(planId, auth.user.userId);
    if (!url || !openExternal(url)) alert(t('pay.unavailable'));
  };

  return (
    <div className="pricing-surface relative z-10 mx-auto max-w-2xl px-4 pb-12 pt-10 sm:px-6">
      <Link to="/" className="press font-mono text-[12px] text-sage hover:text-cream">
        {t('pricing.back')}
      </Link>
      <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-cream">
        {t('pricing.title')}
      </h1>
      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-sage">{t('pricing.sub')}</p>

      <div className="mt-8 space-y-4">
        {PRICING_PLANS_DISPLAY.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = plan.id !== 'free';
          return (
            <section
              key={plan.id}
              className={`rounded-xl px-5 py-5 ring-1 ring-inset ${
                isCurrent ? 'bg-accent/10 ring-accent' : 'bg-ink/50 ring-line'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[17px] font-bold text-cream">{plan.name}</h2>
                <div className="text-right">
                  <div className="font-display text-xl font-bold text-cream">
                    {plan.price}
                    {plan.perKey && (
                      <span className="text-[11px] font-normal text-sage"> {t(plan.perKey)}</span>
                    )}
                  </div>
                  {plan.id === 'pro-yearly' && (
                    <p className="mt-1 text-[11px] font-medium text-accent">
                      {t('pay.yearlyEquiv', {
                        price: PRO_PRICES.yearlyMonthly,
                        n: PRO_PRICES.monthsFree,
                      })}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-faint">{t(plan.descKey)}</p>
              <ul className="pricing-feature-list mt-4 space-y-2.5 border-t border-line/50 pt-4">
                {plan.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-cream">
                      {t(key)}
                    </span>
                  </li>
                ))}
              </ul>
              {isCurrent && (
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                  {t('pay.current')}
                </p>
              )}
              {isPaid && !isCurrent && (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className="press btn-accent mt-5 flex h-10 w-full items-center justify-center rounded-lg font-display text-sm font-bold"
                >
                  {t('pay.upgrade')}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {showManage && (
        <div className="mt-5">
          <ManageSubscriptionButton />
        </div>
      )}

      <section className="mt-8 overflow-hidden rounded-xl bg-ink/50 ring-1 ring-inset ring-line">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line/60 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
              <th scope="col" className="px-4 py-3.5 font-semibold">
                {t('pricing.compareFeature')}
              </th>
              <th scope="col" className="px-4 py-3.5 text-center font-semibold">
                {t('pricing.compareFree')}
              </th>
              <th scope="col" className="px-4 py-3.5 text-center font-semibold">
                {t('pricing.comparePro')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.labelKey} className="border-b border-line/40 last:border-0">
                <td className="px-4 py-3 font-medium text-cream/90">{t(row.labelKey)}</td>
                <td className="px-4 py-3 text-center font-mono text-sage">
                  {row.free.kind === 'key' ? t(row.free.key) : renderValue(row.free)}
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold text-cream">
                  {row.pro.kind === 'key' ? t(row.pro.key) : renderValue(row.pro)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-6 text-[12px] leading-relaxed text-sage">
        <span className="font-semibold text-cream">{t(SYNC_SCOPE_KEY)}</span>
        {' — '}
        {t(SYNC_NOTE_KEY)}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('pricing.localNote')}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{t('pay.note')}</p>
    </div>
  );
}
