import { useMemo, useState } from 'react';
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import { localDayKey } from '../lib/projects';
import type { Skill } from '../lib/skills';
import type { Objective } from '../lib/okrs';
import {
  createLink,
  linksFor,
  otherSide,
  removeLink,
  type EntityLink,
  type LinkEntityType,
} from '../lib/entityLinks';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const TYPE_LABEL: Record<LinkEntityType, TKey> = {
  goal: 'linkedItems.type.goal',
  project: 'linkedItems.type.project',
  skill: 'linkedItems.type.skill',
  journal: 'linkedItems.type.journal',
  objective: 'linkedItems.type.objective',
};

interface Props {
  entityType: LinkEntityType;
  entityId: string;
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  goals: Goal[];
  projects: Project[];
  skills: Skill[];
  objectives: Objective[];
}

interface Candidate {
  id: string;
  title: string;
}

/** Small reusable "linked items" widget — mount inside a Goal/Project/Skill/Journal detail view. */
export default function LinkedItems({
  entityType,
  entityId,
  links,
  onLinksChange,
  goals,
  projects,
  skills,
  objectives,
}: Props) {
  const { t, fmtDayKey } = useI18n();
  const [pickType, setPickType] = useState<LinkEntityType | null>(null);
  const [filter, setFilter] = useState('');

  const todayKey = useMemo(() => localDayKey(Date.now()), []);

  const resolveTitle = (type: LinkEntityType, id: string): string => {
    if (type === 'goal') return goals.find((g) => g.id === id)?.title ?? t('linkedItems.deleted');
    if (type === 'project')
      return projects.find((p) => p.id === id)?.name ?? t('linkedItems.deleted');
    if (type === 'skill') return skills.find((s) => s.id === id)?.name ?? t('linkedItems.deleted');
    if (type === 'objective')
      return objectives.find((o) => o.id === id)?.title ?? t('linkedItems.deleted');
    return t('linkedItems.journalEntryOn', { date: fmtDayKey(id) });
  };

  const mine = linksFor(links, entityType, entityId);

  const otherTypes = (
    ['goal', 'project', 'skill', 'journal', 'objective'] as LinkEntityType[]
  ).filter((x) => x !== entityType);

  const candidatesFor = (type: LinkEntityType): Candidate[] => {
    const linkedIds = new Set(
      mine
        .map((l) => otherSide(l, entityType, entityId))
        .filter((s) => s.type === type)
        .map((s) => s.id),
    );
    if (type === 'journal') {
      if (linkedIds.has(todayKey)) return [];
      return [
        { id: todayKey, title: t('linkedItems.journalEntryOn', { date: fmtDayKey(todayKey) }) },
      ];
    }
    const pool =
      type === 'goal'
        ? goals.filter((g) => !g.archived).map((g) => ({ id: g.id, title: g.title }))
        : type === 'project'
          ? projects.filter((p) => !p.archived).map((p) => ({ id: p.id, title: p.name }))
          : type === 'objective'
            ? objectives.filter((o) => !o.archived).map((o) => ({ id: o.id, title: o.title }))
            : skills.map((s) => ({ id: s.id, title: s.name }));
    const q = filter.trim().toLowerCase();
    return pool
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true))
      .slice(0, 8);
  };

  const addLink = (type: LinkEntityType, id: string) => {
    onLinksChange(createLink(links, entityType, entityId, type, id));
    setPickType(null);
    setFilter('');
  };

  return (
    <div className="mono-stack" style={{ gap: 8 }}>
      <p className="mono-caption">{t('linkedItems.heading')}</p>
      {mine.length > 0 && (
        <div className="mono-inline" style={{ gap: 6 }}>
          {mine.map((link) => {
            const side = otherSide(link, entityType, entityId);
            return (
              <span
                key={link.id}
                className="mono-tag"
                style={{ fontSize: 13.5, padding: '4px 10px' }}
              >
                <span>{t(TYPE_LABEL[side.type])}</span>
                <span
                  style={{
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--mono-fg)',
                  }}
                >
                  {resolveTitle(side.type, side.id)}
                </span>
                <button
                  onClick={() => onLinksChange(removeLink(links, link.id))}
                  className="mono-link-btn"
                  style={{ minHeight: 24, textDecoration: 'none', color: 'inherit' }}
                  aria-label={t('linkedItems.removeLink')}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="mono-inline" style={{ gap: 6 }}>
        {otherTypes.map((type) => (
          <button
            key={type}
            onClick={() => {
              setPickType(pickType === type ? null : type);
              setFilter('');
            }}
            aria-pressed={pickType === type}
            className="mono-chip mono-chip-sm"
          >
            + {t(TYPE_LABEL[type])}
          </button>
        ))}
      </div>

      {pickType && (
        <div className="mono-stack" style={{ gap: 8 }}>
          {pickType !== 'journal' && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('linkedItems.searchPlaceholder')}
              aria-label={t('linkedItems.searchPlaceholder')}
              className="mono-field mono-field-sm"
            />
          )}
          <div className="mono-inline" style={{ gap: 6 }}>
            {candidatesFor(pickType).map((c) => (
              <button
                key={c.id}
                onClick={() => addLink(pickType, c.id)}
                className="mono-btn mono-btn-ghost mono-btn-sm"
              >
                {c.title}
              </button>
            ))}
            {candidatesFor(pickType).length === 0 && (
              <p className="mono-caption">{t('linkedItems.noCandidates')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
