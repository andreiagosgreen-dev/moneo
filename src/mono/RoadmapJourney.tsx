import type { ReactNode } from 'react';
import type { RoadmapStep } from '../lib/ai/roadmap';

type NodeState = 'done' | 'now' | 'soon';

function nodeState(steps: RoadmapStep[], index: number): NodeState {
  const step = steps[index];
  if (step.done) return 'done';
  const firstOpen = steps.findIndex((s) => !s.done);
  if (firstOpen === index) return 'now';
  return 'soon';
}

interface TrackProps {
  steps: RoadmapStep[];
  /** Compact strip (Focus/Azi) vs full (Assistant). */
  compact?: boolean;
  /** Max nodes in compact mode before collapsing middle. */
  maxCompact?: number;
}

/** Horizontal journey dots: done → now (pulse) → soon. */
export function RoadmapJourneyTrack({ steps, compact = false, maxCompact = 8 }: TrackProps) {
  if (steps.length === 0) return null;

  let visible = steps.map((s, i) => ({ step: s, i }));
  if (compact && steps.length > maxCompact) {
    const now = Math.max(
      0,
      steps.findIndex((s) => !s.done),
    );
    const start = Math.max(0, Math.min(now - 2, steps.length - maxCompact));
    visible = steps.slice(start, start + maxCompact).map((s, k) => ({ step: s, i: start + k }));
  }

  return (
    <ol className={`mono-rm-track${compact ? ' is-compact' : ''}`} aria-hidden>
      {visible.map(({ step, i }, visIdx) => {
        const state = nodeState(steps, i);
        return (
          <li key={step.id} className={`mono-rm-node is-${state}`}>
            {visIdx > 0 ? <span className="mono-rm-seg" /> : null}
            <span className="mono-rm-dot" title={step.title}>
              {state === 'done' ? '✓' : String(i + 1)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface RingProps {
  pct: number;
  label: string;
  size?: number;
}

/** Circular progress for the active roadmap. */
export function RoadmapProgressRing({ pct, label, size = 52 }: RingProps) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = c * (1 - clamped / 100);
  return (
    <div
      className="mono-rm-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 44 44" width={size} height={size}>
        <circle className="mono-rm-ring-bg" cx="22" cy="22" r={r} />
        <circle
          className="mono-rm-ring-fg"
          cx="22"
          cy="22"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="mono-rm-ring-label">{Math.round(clamped)}</span>
    </div>
  );
}

interface TrailProps {
  steps: RoadmapStep[];
  children: (step: RoadmapStep, state: NodeState, index: number) => ReactNode;
}

/** Vertical trail for the Assistant editor — each row is a station on the path. */
export function RoadmapJourneyTrail({ steps, children }: TrailProps) {
  return (
    <ol className="mono-rm-trail">
      {steps.map((step, i) => {
        const state = nodeState(steps, i);
        return (
          <li key={step.id} className={`mono-rm-station is-${state}`}>
            <div className="mono-rm-station-rail" aria-hidden>
              <span className="mono-rm-station-dot">{state === 'done' ? '✓' : i + 1}</span>
            </div>
            <div className="mono-rm-station-body">{children(step, state, i)}</div>
          </li>
        );
      })}
    </ol>
  );
}
