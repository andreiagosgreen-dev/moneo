#!/usr/bin/env node
/**
 * Funnel by channel, from the `moneo_events` Analytics Engine dataset.
 *
 *   npm run funnel            # last 30 days
 *   npm run funnel -- 7       # last 7 days
 *   npm run funnel -- 30 campaign   # split by utm_campaign instead of source
 *
 * Needs two environment variables (never commit them):
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare dashboard → Account home → Account ID
 *   CLOUDFLARE_API_TOKEN   — a token with "Account Analytics: Read" only
 *
 * Columns: visits (landing views), sign-ups, checkouts opened, trials
 * started, paid subscriptions started directly, payments and revenue (USD).
 */

const days = Math.min(90, Math.max(1, Number.parseInt(process.argv[2] ?? '30', 10) || 30));
const byCampaign = process.argv[3] === 'campaign';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!account || !token) {
  console.error(
    'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics: Read), then run again.',
  );
  process.exit(1);
}

const group = byCampaign ? 'blob5' : 'blob4';
const sql = `
  SELECT ${group} AS channel, blob1 AS event, blob6 AS status,
         SUM(_sample_interval) AS n,
         SUM(_sample_interval * double2) AS revenue
  FROM moneo_events
  WHERE timestamp > NOW() - INTERVAL '${days}' DAY
  GROUP BY channel, event, status
  FORMAT JSON`;

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`,
  { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: sql },
);
if (!res.ok) {
  console.error(`Cloudflare answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const { data = [] } = await res.json();

const rows = new Map();
const row = (channel) => {
  const key = channel || (byCampaign ? '(no campaign)' : '(before tracking)');
  if (!rows.has(key)) {
    rows.set(key, {
      visits: 0,
      signups: 0,
      checkouts: 0,
      trials: 0,
      paid: 0,
      payments: 0,
      revenue: 0,
    });
  }
  return rows.get(key);
};
for (const r of data) {
  const n = Number(r.n) || 0;
  const target = row(r.channel);
  if (r.event === 'landing_view') target.visits += n;
  else if (r.event === 'sign_up') target.signups += n;
  else if (r.event === 'checkout_open') target.checkouts += n;
  else if (r.event === 'subscribe' && r.status === 'trial') target.trials += n;
  else if (r.event === 'subscribe') target.paid += n;
  else if (r.event === 'payment') {
    target.payments += n;
    target.revenue += Number(r.revenue) || 0;
  }
}

const table = [...rows.entries()]
  .map(([channel, v]) => ({
    [byCampaign ? 'campaign' : 'source']: channel,
    visits: Math.round(v.visits),
    'sign-ups': Math.round(v.signups),
    checkouts: Math.round(v.checkouts),
    trials: Math.round(v.trials),
    'paid starts': Math.round(v.paid),
    payments: Math.round(v.payments),
    'revenue $': v.revenue.toFixed(2),
    'visit→sign-up': v.visits ? `${((v.signups / v.visits) * 100).toFixed(1)}%` : '—',
  }))
  .sort((a, b) => Number(b['revenue $']) - Number(a['revenue $']) || b.visits - a.visits);

console.log(`Moneo funnel — last ${days} days, by ${byCampaign ? 'campaign' : 'source'}`);
if (table.length === 0) console.log('No events yet.');
else console.table(table);
