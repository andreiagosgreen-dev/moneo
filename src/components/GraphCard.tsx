import { useMemo, useState } from 'react';
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import type { Skill } from '../lib/skills';
import type { Objective } from '../lib/okrs';
import type { EntityLink, LinkEntityType } from '../lib/entityLinks';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  links: EntityLink[];
  goals: Goal[];
  projects: Project[];
  skills: Skill[];
  objectives: Objective[];
}

interface GraphNode {
  key: string;
  type: LinkEntityType;
  id: string;
  title: string;
}

const TYPE_COLOR: Record<LinkEntityType, string> = {
  goal: '#f5a524',
  project: '#6ee7b7',
  skill: '#93c5fd',
  journal: '#c4b5fd',
  objective: '#fca5a5',
};

const TYPE_LABEL: Record<LinkEntityType, TKey> = {
  goal: 'linkedItems.type.goal',
  project: 'linkedItems.type.project',
  skill: 'linkedItems.type.skill',
  journal: 'linkedItems.type.journal',
  objective: 'linkedItems.type.objective',
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 128;

export default function GraphCard({ links, goals, projects, skills, objectives }: Props) {
  const { t, fmtDayKey } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);

  const nodes = useMemo<GraphNode[]>(() => {
    const resolveTitle = (type: LinkEntityType, id: string): string => {
      if (type === 'goal')
        return goals.find((g) => g.id === id)?.title ?? t('linkedItems.deleted');
      if (type === 'project')
        return projects.find((p) => p.id === id)?.name ?? t('linkedItems.deleted');
      if (type === 'skill')
        return skills.find((s) => s.id === id)?.name ?? t('linkedItems.deleted');
      if (type === 'objective')
        return objectives.find((o) => o.id === id)?.title ?? t('linkedItems.deleted');
      return fmtDayKey(id);
    };
    const seen = new Map<string, GraphNode>();
    for (const l of links) {
      const aKey = `${l.aType}:${l.aId}`;
      const bKey = `${l.bType}:${l.bId}`;
      if (!seen.has(aKey)) {
        seen.set(aKey, { key: aKey, type: l.aType, id: l.aId, title: resolveTitle(l.aType, l.aId) });
      }
      if (!seen.has(bKey)) {
        seen.set(bKey, { key: bKey, type: l.bType, id: l.bId, title: resolveTitle(l.bType, l.bId) });
      }
    }
    return Array.from(seen.values());
  }, [links, goals, projects, skills, objectives, t, fmtDayKey]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const n = nodes.length;
    nodes.forEach((node, i) => {
      map.set(node.key, polar(CENTER, CENTER, n <= 1 ? 0 : RADIUS, (360 / Math.max(1, n)) * i));
    });
    return map;
  }, [nodes]);

  const touchesSelected = (l: EntityLink) => {
    if (!selected) return true;
    const [type, id] = selected.split(':', 2) as [LinkEntityType, string];
    return (l.aType === type && l.aId === id) || (l.bType === type && l.bId === id);
  };

  if (links.length === 0) {
    return (
      <section className="card px-6 py-6 sm:px-7" aria-label={t('graph.ariaLabel')}>
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('graph.title')}
        </h2>
        <p className="mt-3 rounded-xl border border-dashed border-line/60 px-4 py-6 text-center text-[12px] leading-relaxed text-faint">
          {t('graph.empty')}
        </p>
      </section>
    );
  }

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('graph.ariaLabel')}>
      <header>
        <h2 className="font-display text-xl font-bold tracking-tight text-cream">
          {t('graph.title')}
        </h2>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
          {t('graph.subtitle', { nodes: nodes.length, edges: links.length })}
        </p>
      </header>

      <div className="mt-4 flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {links.map((l) => {
            const a = positions.get(`${l.aType}:${l.aId}`);
            const b = positions.get(`${l.bType}:${l.bId}`);
            if (!a || !b) return null;
            const dim = selected !== null && !touchesSelected(l);
            return (
              <line
                key={l.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgb(242 244 249 / 0.28)"
                strokeWidth={1.5}
                opacity={dim ? 0.15 : 1}
              />
            );
          })}
          {nodes.map((node) => {
            const p = positions.get(node.key);
            if (!p) return null;
            const dim = selected !== null && selected !== node.key;
            return (
              <g
                key={node.key}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(selected === node.key ? null : node.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(selected === node.key ? null : node.key);
                  }
                }}
                style={{ cursor: 'pointer', opacity: dim ? 0.35 : 1 }}
              >
                <circle cx={p.x} cy={p.y} r={7} fill={TYPE_COLOR[node.type]} />
                <title>
                  {t(TYPE_LABEL[node.type])} — {node.title}
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[11px] text-sage">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background:
                TYPE_COLOR[nodes.find((n) => n.key === selected)?.type ?? 'goal'],
            }}
          />
          <span className="max-w-[260px] truncate">
            {nodes.find((n) => n.key === selected)?.title}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        {(['goal', 'project', 'skill', 'journal', 'objective'] as LinkEntityType[]).map((type) => (
          <span key={type} className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: TYPE_COLOR[type] }}
            />
            {t(TYPE_LABEL[type])}
          </span>
        ))}
      </div>
    </section>
  );
}
