import { useMemo, useState } from 'react';
import type { Skill, SkillCategory, SkillLevel } from '../lib/skills';
import {
  SKILL_CATEGORIES,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  FREE_SKILLS_LIMIT,
  createSkillObject,
  updateSkill,
  deleteSkill,
  logLearningMinutes,
  addResource,
  skillProgress,
  totalLearningMinutes,
  formatLearningDuration,
} from '../lib/skills';
import { useI18n } from '../lib/i18n/LocaleContext';
import { cleanupLinksFor, type EntityLink } from '../lib/entityLinks';
import type { Goal } from '../lib/goals';
import type { Project } from '../lib/projects';
import type { Objective } from '../lib/okrs';
import LinkedItems from './LinkedItems';
import SkillTreeCard from './SkillTreeCard';
import Disclosure from './Disclosure';

interface Props {
  skills: Skill[];
  skillsChange: (skills: Skill[]) => void;
  transitionTip?: string | null;
  links: EntityLink[];
  onLinksChange: (links: EntityLink[]) => void;
  goals: Goal[];
  projects: Project[];
  objectives: Objective[];
  isPro?: boolean;
}

const LEVELS: SkillLevel[] = [1, 2, 3, 4, 5];

export default function SkillsCard({
  skills,
  skillsChange,
  transitionTip,
  links,
  onLinksChange,
  goals,
  projects,
  objectives,
  isPro = false,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<SkillCategory>('frontend');
  const [openId, setOpenId] = useState<string | null>(null);
  const [resourceDraft, setResourceDraft] = useState('');
  /** One-shot level-up flash per skill (Faza 16) — meaningful, not a loop. */
  const [levelFlash, setLevelFlash] = useState<Record<string, number>>({});
  /** Last XP gain per skill, for the "+N XP" one-shot flash (Faza 17). */
  const [xpFlash, setXpFlash] = useState<Record<string, number>>({});

  const logSession = (skillId: string) => {
    const { skills: next, xpGained } = logLearningMinutes(skills, skillId, 25);
    skillsChange(next);
    setXpFlash((f) => ({ ...f, [skillId]: xpGained }));
  };

  const total = useMemo(() => totalLearningMinutes(skills), [skills]);
  const atCapacity = !isPro && skills.length >= FREE_SKILLS_LIMIT;

  const add = () => {
    if (!draft.trim() || atCapacity) return;
    skillsChange([...skills, createSkillObject(draft, draftCategory)]);
    setDraft('');
  };

  const open = skills.find((s) => s.id === openId) ?? null;
  const addOpenResource = () => {
    if (!open || !resourceDraft.trim()) return;
    skillsChange(addResource(skills, open.id, resourceDraft));
    setResourceDraft('');
  };

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('skills.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('skills.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro
              ? t('skills.subtitlePro')
              : t('skills.subtitleFree', { n: String(FREE_SKILLS_LIMIT) })}
          </p>
        </div>
        <span className="font-mono text-[11px] text-sage">{formatLearningDuration(total)}</span>
      </header>

      {transitionTip && (
        <p className="mt-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-[12px] leading-relaxed text-cream">
          🚀 {transitionTip}
        </p>
      )}

      {skills.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('skills.emptyLine1')}
          <br />
          {t('skills.emptyLine2')}
        </p>
      ) : (
        <Disclosure title={t('skills.tree.title')} hint={t('skills.tree.subtitle')} defaultOpen={false}>
          <SkillTreeCard skills={skills} links={links} onSelect={setOpenId} />
        </Disclosure>
      )}
      {skills.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {skills.map((skill) => {
            const pct = Math.round(skillProgress(skill) * 100);
            const expanded = openId === skill.id;
            return (
              <li
                key={skill.id}
                className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setOpenId(expanded ? null : skill.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-cream hover:text-accent"
                    title={t('skills.showDetails')}
                  >
                    {skill.certified && <span aria-label={t('skills.certified')}>★ </span>}
                    {skill.name}
                  </button>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">
                    {t(CATEGORY_LABELS[skill.category])}
                  </span>
                  <button
                    onClick={() => {
                      skillsChange(deleteSkill(skills, skill.id));
                      onLinksChange(cleanupLinksFor(links, 'skill', skill.id));
                    }}
                    className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-faint hover:text-cream"
                    aria-label={t('skills.deleteAria', { name: skill.name })}
                  >
                    ✕
                  </button>
                </div>

                {/* level dots */}
                <div className="mt-2 flex items-center gap-1.5">
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={t('skills.currentLevel')}
                  >
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
                        onClick={() => {
                          if (lv > skill.level) {
                            setLevelFlash((f) => ({ ...f, [skill.id]: (f[skill.id] ?? 0) + 1 }));
                          }
                          skillsChange(updateSkill(skills, skill.id, { level: lv }));
                        }}
                        className={`press h-3.5 w-3.5 rounded-full ring-1 ring-inset transition-colors ${
                          lv <= skill.level
                            ? 'bg-accent ring-accent'
                            : 'bg-ink ring-line hover:ring-accent/60'
                        }`}
                        title={t('skills.levelTitle', {
                          level: String(lv),
                          name: t(LEVEL_LABELS[lv]),
                        })}
                        aria-label={t('skills.setLevelAria', { level: String(lv) })}
                      />
                    ))}
                  </div>
                  <span
                    key={levelFlash[skill.id] ?? 0}
                    className={`font-mono text-[11px] text-sage ${
                      levelFlash[skill.id] ? 'pop' : ''
                    }`}
                  >
                    {t(LEVEL_LABELS[skill.level])}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-faint">
                    → {t(LEVEL_LABELS[skill.targetLevel])}
                  </span>
                  <select
                    value={skill.targetLevel}
                    onChange={(e) =>
                      skillsChange(
                        updateSkill(skills, skill.id, {
                          targetLevel: Number(e.target.value) as SkillLevel,
                        }),
                      )
                    }
                    className="h-7 rounded-md bg-ink/60 px-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                    aria-label={t('skills.targetLevel')}
                  >
                    {LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </div>

                {/* progress + log time */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-faint">
                    {formatLearningDuration(skill.minutesLogged)}
                  </span>
                  <span
                    key={xpFlash[skill.id] ?? 0}
                    className={`font-mono text-[10px] text-accent ${
                      xpFlash[skill.id] ? 'pop' : ''
                    }`}
                    title={t('skills.xpTitle')}
                  >
                    {skill.xp} XP
                  </span>
                  <button
                    onClick={() => logSession(skill.id)}
                    className="press shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                    title={t('skills.logSession')}
                  >
                    +25m
                  </button>
                  <button
                    onClick={() =>
                      skillsChange(updateSkill(skills, skill.id, { certified: !skill.certified }))
                    }
                    className={`press shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset ${
                      skill.certified
                        ? 'text-accent ring-accent/60'
                        : 'text-faint ring-line hover:text-cream'
                    }`}
                    title={
                      skill.certified ? t('skills.removeCertification') : t('skills.markCertified')
                    }
                    aria-pressed={skill.certified === true}
                  >
                    ★
                  </button>
                </div>

                {/* resources */}
                {expanded && (
                  <div className="mt-2.5 border-t border-line/60 pt-2.5">
                    {skill.resources.length === 0 ? (
                      <p className="font-mono text-[11px] text-faint">{t('skills.noResources')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {skill.resources.map((r) => (
                          <li
                            key={r}
                            className="truncate font-mono text-[11px] text-sage"
                            title={r}
                          >
                            → {r}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={resourceDraft}
                        maxLength={200}
                        onChange={(e) => setResourceDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addOpenResource()}
                        placeholder={t('skills.resourcePlaceholder')}
                        className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2.5 font-mono text-[11px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                      />
                      <button
                        onClick={addOpenResource}
                        disabled={!resourceDraft.trim()}
                        className="press btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-base font-bold disabled:opacity-40"
                        aria-label={t('skills.addResourceAria')}
                      >
                        +
                      </button>
                    </div>
                    <LinkedItems
                      entityType="skill"
                      entityId={skill.id}
                      links={links}
                      onLinksChange={onLinksChange}
                      goals={goals}
                      projects={projects}
                      skills={skills}
                      objectives={objectives}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* add */}
      {!atCapacity ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={
              skills.length === 0
                ? t('skills.form.placeholderFirst')
                : t('skills.form.placeholderNext')
            }
            className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
          <select
            value={draftCategory}
            onChange={(e) => setDraftCategory(e.target.value as SkillCategory)}
            className="h-9 shrink-0 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label={t('skills.form.categoryAria')}
          >
            {SKILL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(CATEGORY_LABELS[c])}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
            aria-label={t('skills.form.addAria')}
          >
            +
          </button>
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              {t('skills.capacityLine', { n: String(FREE_SKILLS_LIMIT) })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">{t('skills.capacityUpgrade')}</p>
          </div>
        )
      )}
    </section>
  );
}
