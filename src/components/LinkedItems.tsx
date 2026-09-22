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
    <div className="mt-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        {t('linkedItems.heading')}
      </p>
      {mine.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {mine.map((link) => {
            const side = otherSide(link, entityType, entityId);
            return (
              <span
                key={link.id}
                className="flex items-center gap-1 rounded-full bg-ink/60 px-2.5 py-1 font-mono text-[10px] text-sage ring-1 ring-inset ring-line"
              >
                <span className="text-faint">{t(TYPE_LABEL[side.type])}</span>
                <span className="max-w-[160px] truncate">{resolveTitle(side.type, side.id)}</span>
                <button
                  onClick={() => onLinksChange(removeLink(links, link.id))}
                  className="press text-faint hover:text-tomato"
                  aria-label={t('linkedItems.removeLink')}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {otherTypes.map((type) => (
          <button
            key={type}
            onClick={() => {
              setPickType(pickType === type ? null : type);
              setFilter('');
            }}
            className={`press rounded-full px-2.5 py-1 font-mono text-[10px] ring-1 ring-inset ${
              pickType === type
                ? 'text-accent ring-accent/50'
                : 'text-faint ring-line hover:text-cream'
            }`}
          >
            + {t(TYPE_LABEL[type])}
          </button>
        ))}
      </div>

      {pickType && (
        <div className="mt-1.5">
          {pickType !== 'journal' && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('linkedItems.searchPlaceholder')}
              className="h-8 w-full rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {candidatesFor(pickType).map((c) => (
              <button
                key={c.id}
                onClick={() => addLink(pickType, c.id)}
                className="press rounded-lg bg-ink/50 px-2.5 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
              >
                {c.title}
              </button>
            ))}
            {candidatesFor(pickType).length === 0 && (
              <p className="font-mono text-[10px] text-faint">{t('linkedItems.noCandidates')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
