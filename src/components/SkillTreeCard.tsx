import { useMemo, useState } from 'react';
import type { Skill } from '../lib/skills';
import { SKILL_CATEGORIES, CATEGORY_LABELS } from '../lib/skills';
import type { EntityLink } from '../lib/entityLinks';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  skills: Skill[];
  links: EntityLink[];
  onSelect: (id: string) => void;
}

const COL_W = 90;
const ROW_H = 46;
const NODE_R = 12;
const PAD_TOP = 20;
const PAD_LEFT = 60;

/**
 * Visual skill tree (Faza 23) — over skills.ts + the Faza 14 link graph,
 * no new data modeling. Branches = categories (columns), tiers = level
 * (1 bottom, 5 top); skill-skill links (already linkable via LinkedItems
 * since Faza 14/19) draw the "unlock paths" between nodes.
 */
export default function SkillTreeCard({ skills, links, onSelect }: Props) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState<string | null>(null);

  const columns = useMemo(
    () => SKILL_CATEGORIES.filter((c) => skills.some((s) => s.category === c)),
    [skills],
  );

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const skill of skills) {
      const col = columns.indexOf(skill.category);
      if (col === -1) continue;
      map.set(skill.id, {
        x: PAD_LEFT + col * COL_W,
        y: PAD_TOP + (5 - skill.level) * ROW_H,
      });
    }
    return map;
  }, [skills, columns]);

  const skillLinks = useMemo(
    () => links.filter((l) => l.aType === 'skill' && l.bType === 'skill'),
    [links],
  );

  const width = PAD_LEFT + Math.max(1, columns.length - 1) * COL_W + 40;
  const height = PAD_TOP + 4 * ROW_H + 40;

  if (skills.length === 0) return null;

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line/60 bg-ink/30 p-3">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
        {/* tier gridlines */}
        {[1, 2, 3, 4, 5].map((lv) => (
          <line
            key={lv}
            x1={PAD_LEFT - 24}
            y1={PAD_TOP + (5 - lv) * ROW_H + NODE_R}
            x2={width - 20}
            y2={PAD_TOP + (5 - lv) * ROW_H + NODE_R}
            stroke="rgb(242 244 249 / 0.08)"
            strokeWidth={1}
          />
        ))}
        {[1, 2, 3, 4, 5].map((lv) => (
          <text
            key={`label-${lv}`}
            x={PAD_LEFT - 32}
            y={PAD_TOP + (5 - lv) * ROW_H + NODE_R + 4}
            textAnchor="end"
            fontSize={9}
            fontFamily="monospace"
            fill="rgb(242 244 249 / 0.35)"
          >
            {lv}
          </text>
        ))}
        {columns.map((c, i) => (
          <text
            key={c}
            x={PAD_LEFT + i * COL_W}
            y={12}
            textAnchor="middle"
            fontSize={9}
            fontFamily="monospace"
            fill="rgb(242 244 249 / 0.5)"
          >
            {t(CATEGORY_LABELS[c]).toUpperCase().slice(0, 10)}
          </text>
        ))}
        {skillLinks.map((l) => {
          const a = positions.get(l.aId);
          const b = positions.get(l.bId);
          if (!a || !b) return null;
          const dim = hovered !== null && hovered !== l.aId && hovered !== l.bId;
          return (
            <line
              key={l.id}
              x1={a.x}
              y1={a.y + NODE_R}
              x2={b.x}
              y2={b.y + NODE_R}
              stroke="rgb(147 197 253 / 0.35)"
              strokeWidth={1.5}
              opacity={dim ? 0.12 : 1}
            />
          );
        })}
        {skills.map((skill) => {
          const p = positions.get(skill.id);
          if (!p) return null;
          const dim = hovered !== null && hovered !== skill.id;
          const opacity = 0.35 + skill.level * 0.13;
          return (
            <g
              key={skill.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(skill.id)}
              onMouseEnter={() => setHovered(skill.id)}
              onMouseLeave={() => setHovered(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(skill.id);
                }
              }}
              style={{ cursor: 'pointer', opacity: dim ? 0.3 : 1 }}
            >
              <circle
                cx={p.x}
                cy={p.y + NODE_R}
                r={NODE_R}
                fill="var(--accent)"
                fillOpacity={opacity}
                stroke="var(--accent)"
                strokeWidth={1.5}
              />
              <title>
                {skill.name} — {t('skills.tree.levelTitle', { level: String(skill.level) })}
              </title>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center font-mono text-[10px] text-faint">{t('skills.tree.hint')}</p>
    </div>
  );
}
