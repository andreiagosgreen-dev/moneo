import { useAuth } from '../lib/authProvider';
import { getPricingPlans, initiateCheckout, type Plan } from '../lib/billing/lemonSqueezy';
import { reportError } from '../lib/observability/sentry';

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
      className="text-emerald-400"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function PricingCard() {
  const auth = useAuth();
  const plans = getPricingPlans();
  const currentPlan: Plan = auth.isPro ? (auth.subscription.planId as Plan) : 'free';

  const handleSubscribe = (planId: Plan) => {
    if (!auth.user) {
      alert('Please sign in to upgrade to Pro');
      return;
    }

    const checkoutUrl = initiateCheckout(planId, auth.user.userId);
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    } else {
      alert('Checkout is not available. Please contact support.');
      void reportError(new Error('checkout unavailable'), { planId });
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-ink/50 px-5 py-5">
      <div className="flex items-center gap-2">
        <StarIcon />
        <h3 className="font-display text-[15px] font-bold text-cream">Upgrade to Pro</h3>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-sage">
        Unlock cloud sync, advanced analytics, and more.
      </p>

      <div className="mt-4 space-y-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = plan.id !== 'free';

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 transition-all ${
                isCurrent
                  ? 'border-accent bg-accent/10'
                  : isPaid
                    ? 'border-line hover:border-line/70 bg-ink/30'
                    : 'border-line/50 bg-ink/20'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-cream">{plan.name}</h4>
                    {isCurrent && (
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-faint">{plan.description}</p>
                  <div className="mt-2 font-display text-lg font-bold text-cream">
                    {plan.price}
                    {plan.id !== 'free' && (
                      <span className="text-[11px] font-normal text-sage">
                        {' '}
                        /{plan.id === 'pro-yearly' ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[11px] text-sage">
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isPaid && !isCurrent && (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  className="press btn-accent mt-4 flex h-9 w-full items-center justify-center rounded-lg font-display text-sm font-bold"
                >
                  Upgrade
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Cancel anytime. All plans include a 7-day free trial.
      </p>
    </div>
  );
}
