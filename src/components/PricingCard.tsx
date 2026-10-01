import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authProvider';
import { initiateCheckout, type Plan } from '../lib/billing/lemonSqueezy';
import ManageSubscriptionButton from './ManageSubscriptionButton';
import { loginPathForUpgrade, type PaidPlanId } from '../lib/billing/upgradeIntent';
import {
  PRICING_PLANS_DISPLAY,
  PRO_PRICES,
  SYNC_NOTE_KEY,
  SYNC_SCOPE_KEY,
} from '../lib/billing/pricingConfig';
import { useI18n } from '../lib/i18n/LocaleContext';
import { openExternal } from '../lib/links';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/legal/seller';

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
      style={{ marginTop: 3, flexShrink: 0, color: 'var(--mono-accent)' }}
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
      style={{ color: 'var(--mono-accent)' }}
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
  const navigate = useNavigate();
  const [payError, setPayError] = useState('');
  const currentPlan: Plan = auth.isPro ? (auth.subscription.planId as Plan) : 'free';
  // A paying subscriber switches plans in the Lemon portal — a second checkout
  // would start a second, parallel subscription (double billing).
  const hasPaidSub = auth.subscription.isPro && auth.subscription.planId !== 'free';

  const handleSubscribe = (planId: PaidPlanId) => {
    setPayError('');
    if (!auth.user) {
      navigate(loginPathForUpgrade(planId));
      return;
    }

    const checkoutUrl = initiateCheckout(planId, auth.user.userId, auth.user.email);
    if (!checkoutUrl || !openExternal(checkoutUrl)) {
      setPayError(t('pay.unavailable'));
    }
  };

  return (
    <div className="mono-stack" style={{ gap: 14 }}>
      <div className="mono-row" style={{ gap: 8 }}>
        <StarIcon />
        <h3 className="mono-h3">{t('pay.title')}</h3>
      </div>
      <p className="mono-meta" style={{ fontSize: 14.5 }}>
        {t('pay.sub')}
      </p>

      <ul className="mono-stack" style={{ gap: 12 }}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPaid = plan.id !== 'free';

          return (
            <li key={plan.id} className={isCurrent ? 'mono-item mono-plan-current' : 'mono-item'}>
              <div className="mono-row" style={{ gap: 8 }}>
                <h4 className="mono-h3">{t(plan.nameKey)}</h4>
                {isCurrent && (
                  <span className="mono-pill mono-pill-accent">{t('pay.current')}</span>
                )}
              </div>
              <p className="mono-caption" style={{ marginTop: 4 }}>
                {t(plan.descKey)}
              </p>
              <p className="mono-plan-price">
                {plan.price}
                {plan.perKey && <small> {t(plan.perKey)}</small>}
              </p>
              {plan.id === 'pro-yearly' && (
                <p className="mono-caption" style={{ color: 'var(--mono-accent)' }}>
                  {t('pay.yearlyEquiv', {
                    price: PRO_PRICES.yearlyMonthly,
                    n: PRO_PRICES.monthsFree,
                  })}
                </p>
              )}

              <ul className="mono-stack mono-plan-features">
                {plan.featureKeys.map((key) => (
                  <li key={key} className="mono-row" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <CheckIcon />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>

              {isPaid && !isCurrent && hasPaidSub && (
                <p className="mono-meta" style={{ marginTop: 14 }}>
                  {t('pay.switchHint')}
                </p>
              )}
              {isPaid && !isCurrent && !hasPaidSub && (
                <button
                  onClick={() => handleSubscribe(plan.id as PaidPlanId)}
                  className="mono-btn mono-btn-primary mono-btn-block"
                  style={{ marginTop: 14 }}
                >
                  {t('pay.upgrade')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {hasPaidSub && <ManageSubscriptionButton />}

      {payError && (
        <p role="alert" className="mono-note mono-note-danger">
          {payError}{' '}
          <a href={SUPPORT_MAILTO} className="mono-link">
            {SUPPORT_EMAIL}
          </a>
        </p>
      )}

      <p className="mono-caption">{t('pay.note')}</p>
      <p className="mono-meta" style={{ fontSize: 14.5 }}>
        <strong style={{ color: 'var(--mono-fg-2)' }}>{t(SYNC_SCOPE_KEY)}</strong>
        {' — '}
        {t(SYNC_NOTE_KEY)}
      </p>
    </div>
  );
}
