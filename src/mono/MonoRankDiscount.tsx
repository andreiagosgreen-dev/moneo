import { useEffect, useState } from 'react';
import { useAuth } from '../lib/authProvider';
import { buildCheckoutUrl, getSupabaseAccessToken } from '../lib/billing/lemonSqueezy';
import {
  DISCOUNT_CODE_VALID_DAYS,
  DISCOUNT_MIN_ACCOUNT_DAYS,
  requestRankDiscount,
  type RankDiscountStatus,
} from '../lib/billing/rankDiscount';
import { useI18n } from '../lib/i18n/LocaleContext';
import { openPaymentPage } from '../lib/links';
import { loadAtmosphere, resolveAtmosphere } from './atmosphere';
import { RANK_KEYS } from './rankLabel';

/**
 * Rank reward on the pricing and account pages. The offer, rank and percent
 * all come from the Worker (rank recomputed from synced data); when the
 * endpoint is not configured or the account has nothing to gain, this
 * renders nothing. Only "how to become eligible" hints are shown otherwise.
 */
export default function MonoRankDiscount({ className = '' }: { className?: string }) {
  const { t, tag, fmtNum } = useI18n();
  const auth = useAuth();
  const userId = auth.user?.userId ?? null;
  const [status, setStatus] = useState<RankDiscountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    let live = true;
    void requestRankDiscount('GET', getSupabaseAccessToken).then((s) => {
      if (live) setStatus(s);
    });
    return () => {
      live = false;
    };
  }, [userId, auth.isPro]);

  if (!userId || !status) return null;

  const hint =
    status.reason === 'too_new'
      ? t('mono.discount.hintTooNew', { days: DISCOUNT_MIN_ACCOUNT_DAYS })
      : status.reason === 'rank_too_low' && status.targetRank && status.targetLevel
        ? t('mono.discount.hintRank', {
            rank: t(RANK_KEYS[status.targetRank]),
            level: fmtNum(status.targetLevel),
            pct: fmtNum(status.targetPercent ?? 0),
          })
        : null;
  if (!status.eligible && !hint) return null;

  const openCheckout = async () => {
    setError(false);
    let code = status.discountCode;
    if (!code) {
      setBusy(true);
      const minted = await requestRankDiscount('POST', getSupabaseAccessToken);
      setBusy(false);
      if (!minted) {
        setError(true);
        return;
      }
      setStatus(minted);
      code = minted.discountCode;
      if (!code) {
        if (!minted.eligible) return;
        setError(true);
        return;
      }
    }
    const url = buildCheckoutUrl('pro-monthly', userId, code, auth.user?.email);
    if (!url) {
      setError(true);
      return;
    }
    openPaymentPage(url);
  };

  const rankName = t(RANK_KEYS[status.rank]);
  const expires = status.expiresAt ? new Date(status.expiresAt) : null;

  return (
    <div
      className={`atm-root mono-rank-host ${className}`.trim()}
      data-atmosphere={resolveAtmosphere(loadAtmosphere(), auth.isPro)}
    >
      <section
        className="mono-card mono-discount"
        aria-label={t('mono.discount.eyebrow')}
        data-testid="rank-discount"
      >
        <p className="mono-eyebrow">{t('mono.discount.eyebrow')}</p>
        {status.eligible ? (
          <>
            <h3 className="mono-h2 mono-discount-title">
              {t('mono.discount.firstMonth', { rank: rankName, pct: fmtNum(status.percent) })}
            </h3>
            <p className="mono-meta">
              {t('mono.discount.terms', { days: DISCOUNT_CODE_VALID_DAYS })}
            </p>
            {status.discountCode && expires && !Number.isNaN(expires.getTime()) && (
              <p className="mono-meta mono-discount-code">
                {t('mono.discount.code', {
                  code: status.discountCode,
                  date: expires.toLocaleDateString(tag),
                })}
              </p>
            )}
            <button
              type="button"
              className="mono-btn mono-btn-primary mono-discount-cta"
              onClick={() => void openCheckout()}
              disabled={busy}
            >
              {busy ? t('mono.discount.ctaBusy') : t('mono.discount.cta')}
            </button>
            {error && (
              <p role="alert" className="mono-meta mono-discount-error">
                {t('mono.discount.error')}
              </p>
            )}
            <p className="mono-meta mono-rank-note">{t('mono.discount.verified')}</p>
          </>
        ) : (
          <p className="mono-meta">{hint}</p>
        )}
      </section>
    </div>
  );
}
