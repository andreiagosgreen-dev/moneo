import { Link } from 'react-router-dom';
import PricingCard from './PricingCard';

/**
 * Public pricing page. Reuses PricingCard so plans/features come from the
 * single source of truth (getPricingPlans in lib/billing/lemonSqueezy) —
 * no separate hardcoded comparison table to drift out of sync.
 */
export default function PricingPage() {
  return (
    <div className="relative z-10 mx-auto max-w-2xl px-4 pb-10 pt-10 sm:px-6">
      <Link to="/" className="press font-mono text-[12px] text-sage hover:text-cream">
        ← Back to Moneo
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-cream">
        Simple pricing
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-sage">
        Start free, local-first, no account required. Upgrade when you need cloud sync, advanced
        planning and reports.
      </p>
      <div className="mt-6">
        <PricingCard />
      </div>
    </div>
  );
}
