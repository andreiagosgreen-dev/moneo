import { memo, useMemo } from 'react';
import { type Session } from '../lib/store';
import { getGrowthSummary, GROWTH_STAGES, GROWTH_STAGE_KEYS } from '../lib/growth';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

/**
 * Moneo Growth — the quiet, persistent visual of accumulated focus.
 * Abstract organic geometry: a seed orb, sweeping orbital arcs, golden-angle
 * branches and bloom nodes. Fully derived from history; deterministic.
 * Memoized on history identity — never re-renders on countdown ticks.
 */

const GOLDEN = 137.507; // degrees — organic, never repeating placement

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function GrowthForm({ stage, progress }: { stage: number; progress: number }) {
  const C = 100;
  // Ghost orbits — the shape growth will fill.
  const orbits = [46, 68, 90];
  // Stage 1+: accent arc sweeping with in-stage progress.
  const r1 = 46;
  const c1 = 2 * Math.PI * r1;
  const sweep1 = Math.max(0.04, stage === 1 ? progress : stage > 1 ? 1 : 0.04);
  const tip1 = polar(C, C, r1, 360 * sweep1);
  // Stage 2+: second arc offset by the golden angle + three branches.
  const r2 = 68;
  const c2 = 2 * Math.PI * r2;
  const sweep2 = stage === 2 ? Math.max(0.06, progress) : stage > 2 ? 1 : 0;
  const rot2 = GOLDEN;
  const tip2 = polar(C, C, r2, rot2 + 360 * sweep2);
  const branches = [0, 1, 2].map((i) => {
    const a = rot2 + i * GOLDEN;
    const from = polar(C, C, r1 - 6, a);
    const to = polar(C, C, r2 - 6, a + 14);
    const mid = polar(C, C, (r1 + r2) / 2, a + 22);
    return { from, to, mid, node: polar(C, C, r2 - 6, a + 14) };
  });
  // Stage 3: complete outer ring + halo + five bloom nodes.
  const r3 = 90;
  const c3 = 2 * Math.PI * r3;
  const blooms = [0, 1, 2, 3, 4].map((i) => polar(C, C, r3, i * GOLDEN));
  const seedR = 9 + stage * 2.2;

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden focusable="false">
      {/* ghost orbits */}
      {orbits.map((r) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke="rgb(242 244 249 / 0.08)"
          strokeWidth="1.5"
        />
      ))}

      {/* stage 3: outer completion ring + halo */}
      {stage >= 3 && (
        <>
          <circle
            className="growth-anim"
            cx={C}
            cy={C}
            r={r3}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.28"
            strokeWidth="1.5"
            strokeDasharray={`${c3 * 0.02} ${c3 * 0.045}`}
            strokeLinecap="round"
          />
          {blooms.map((p, i) => (
            <circle
              key={i}
              className="growth-anim"
              cx={p.x}
              cy={p.y}
              r="3.4"
              fill="var(--accent)"
              opacity="0.9"
            />
          ))}
        </>
      )}

      {/* stage 2+: branches + second arc */}
      {stage >= 2 && (
        <>
          {branches.map((b, i) => (
            <g key={i} className="growth-anim">
              <path
                d={`M ${b.from.x} ${b.from.y} Q ${b.mid.x} ${b.mid.y} ${b.to.x} ${b.to.y}`}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.55"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={b.node.x} cy={b.node.y} r="2.6" fill="var(--accent)" opacity="0.75" />
            </g>
          ))}
          <circle
            className="growth-anim"
            cx={C}
            cy={C}
            r={r2}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.7"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={`${c2 * sweep2} ${c2}`}
            transform={`rotate(${rot2 - 90} ${C} ${C})`}
          />
          {sweep2 > 0 && <circle cx={tip2.x} cy={tip2.y} r="3.6" fill="#eef1e8" />}
        </>
      )}

      {/* stage 1+: first arc */}
      {stage >= 1 && (
        <>
          <circle
            className="growth-anim"
            cx={C}
            cy={C}
            r={r1}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${c1 * sweep1} ${c1}`}
            transform={`rotate(-90 ${C} ${C})`}
          />
          <circle className="growth-anim" cx={tip1.x} cy={tip1.y} r="4" fill="#eef1e8" />
        </>
      )}

      {/* seed */}
      <circle cx={C} cy={C} r={seedR + 9} fill="var(--accent)" opacity="0.12" />
      <circle cx={C} cy={C} r={seedR} fill="var(--accent)" />
      <circle
        cx={C - seedR * 0.3}
        cy={C - seedR * 0.3}
        r={seedR * 0.32}
        fill="#eef1e8"
        opacity="0.5"
      />
    </svg>
  );
}

function GrowthCardBase({ history }: { history: Session[] }) {
  const { t, fmtDur, fmtNum } = useI18n();
  const g = useMemo(() => getGrowthSummary(history), [history]);
  const stageName = t(GROWTH_STAGE_KEYS[g.stage] as TKey);

  return (
    <section className="card flex h-full items-center gap-5 overflow-hidden px-6 py-6 sm:px-7" aria-label={t('growth.aria')}>
      <div className="h-24 w-24 shrink-0 sm:h-28 sm:w-28">
        <GrowthForm stage={g.stage} progress={g.progress} />
      </div>
      <div className="growth-card-body flex-1">
        <div
          className="font-display text-4xl font-extrabold leading-none tracking-tight"
          style={{ color: 'var(--accent)' }}
        >
          {fmtDur(g.total)}
        </div>
        <p className="text-[12px] text-faint">{t('growth.total')}</p>
        <div className="growth-card-pills">
          <span className="rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[11px] text-sage ring-1 ring-inset ring-line">
            {t('growth.today')} <span className="text-cream">{fmtDur(g.today)}</span>
          </span>
          <span className="rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[11px] text-sage ring-1 ring-inset ring-line">
            {t('growth.week')} <span className="text-cream">{fmtDur(g.week)}</span>
          </span>
        </div>
        {/* stage hint — internal names surfaced only as quiet dots */}
        <div className="growth-card-stages" aria-hidden>
          {GROWTH_STAGES.map((s, i) => (
            <span
              key={s.name}
              className="h-1.5 w-4 rounded-full transition-colors duration-500"
              style={{
                background: i <= g.stage ? 'var(--accent)' : 'rgb(242 244 249 / 0.12)',
              }}
              title={t(GROWTH_STAGE_KEYS[i] as TKey)}
            />
          ))}
        </div>
      </div>
      {/* accessible summary — the SVG itself is decorative */}
      <p className="sr-only">
        {t('growth.sr', {
          total: fmtNum(g.total),
          stage: fmtNum(g.stage + 1),
          stages: fmtNum(GROWTH_STAGES.length),
          name: stageName,
        })}
      </p>
    </section>
  );
}

const GrowthCard = memo(GrowthCardBase);
export default GrowthCard;
