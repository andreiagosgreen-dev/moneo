import { useAuth } from '../lib/authProvider';
import { checkoutReturnUrl, initiateCheckout, type Plan } from '../lib/billing/lemonSqueezy';
import {
  PRICING_PLANS_DISPLAY,
  PRO_PRICES,
  SYNC_NOTE_KEY,
  SYNC_SCOPE_KEY,
} from '../lib/billing/pricingConfig';
import { useI18n } from '../lib/i18n/LocaleContext';
import { openExternal } from '../lib/links';

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

function StarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-accent"
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function PricingCard() {
  const { t } = useI18n();
  const auth = useAuth();
  const plans = PRICING_PLANS_DISPLAY;
  const currentPlan: Plan = auth.isPro ? (auth.subscription.planId as Plan) : 'free';

  const handleSubscribe = (planId: Plan) => {
    if (!auth.user) {
      alert(t('pay.signin'));
      return;
    }

    const checkoutUrl = initiateCheckout(planId, auth.user.userId, checkoutReturnUrl());
    if (!checkoutUrl || !openExternal(checkoutUrl)) {
      alert(t('pay.unavailable'));
    }
  };

  return (
    <div className="pricing-surface rounded-2xl border border-line bg-ink/50 px-5 py-6">
      <div className="flex items-center gap-2">
        <StarIcon />
        <h3 className="font-display text-[15px] font-bold text-cream">{t('pay.title')}</h3>
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-sage">{t('pay.sub')}</p>

      <div className="mt-5 space-y-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = plan.id !== 'free';

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 transition-colors ${
                isCurrent
                  ? 'border-accent bg-accent/10'
                  : isPaid
                    ? 'border-line bg-ink/30 hover:border-accent/40'
                    : 'border-line/60 bg-ink/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-cream">{plan.name}</h4>
                    {isCurrent && (
                      <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {t('pay.current')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{t(plan.descKey)}</p>
                  <div className="mt-2.5 font-display text-lg font-bold text-cream">
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

              <ul className="pricing-feature-list mt-4 space-y-2 border-t border-line/50 pt-3.5">
                {plan.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-cream">
                      {t(key)}
                    </span>
                  </li>
                ))}
              </ul>

              {isPaid && !isCurrent && (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className="press btn-accent mt-4 flex h-9 w-full items-center justify-center rounded-lg font-display text-sm font-bold"
                >
                  {t('pay.upgrade')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-faint">{t('pay.note')}</p>
      <p className="mt-3 text-[12px] leading-relaxed text-sage">
        <span className="font-semibold text-cream">{t(SYNC_SCOPE_KEY)}</span>
        {' — '}
        {t(SYNC_NOTE_KEY)}
      </p>
    </div>
  );
}
