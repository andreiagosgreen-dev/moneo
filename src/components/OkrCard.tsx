import { useMemo, useState } from 'react';
import type { Objective } from '../lib/okrs';
import {
  FREE_OKRS_LIMIT,
  addKeyResult,
  childrenOf,
  createObjectiveObject,
  currentPeriod,
  deleteObjective,
  krProgress,
  objectiveProgress,
  okrPeriods,
  okrReview,
  overallOkrProgress,
  removeKeyResult,
  rootObjectives,
  updateKeyResult,
  updateObjective,
} from '../lib/okrs';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  objectives: Objective[];
  objectivesChange: (objectives: Objective[]) => void;
  isPro?: boolean;
}

export default function OkrCard({ objectives, objectivesChange, isPro = false }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const [draft, setDraft] = useState('');
  const [draftParent, setDraftParent] = useState('');
  const [period, setPeriod] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [review, setReview] = useState<string | null>(null);

  const periods = useMemo(() => okrPeriods(objectives), [objectives]);
  const activePeriod = period || currentPeriod();
  const roots = useMemo(
    () => rootObjectives(objectives, period || undefined),
    [objectives, period],
  );
  const archived = useMemo(() => objectives.filter((o) => o.archived), [objectives]);
  const overall = useMemo(
    () => overallOkrProgress(objectives, period || undefined),
    [objectives, period],
  );
  const progressOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of objectives) map.set(o.id, objectiveProgress(objectives, o.id));
    return map;
  }, [objectives]);

  const liveCount = objectives.filter((o) => !o.archived).length;
  const atCapacity = !isPro && liveCount >= FREE_OKRS_LIMIT;

  const add = () => {
    if (!draft.trim() || atCapacity) return;
    const objective = createObjectiveObject(
      objectives,
      draft,
      activePeriod,
      draftParent || undefined,
    );
    if (!objective) return;
    objectivesChange([...objectives, objective]);
    setDraft('');
    setDraftParent('');
  };

  const validParents = objectives.filter((o) => !o.archived);

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label={t('okr.ariaLabel')}>
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('okr.title')}
          </h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? t('okr.subtitlePro') : t('okr.subtitleFree', { n: String(FREE_OKRS_LIMIT) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-extrabold" style={{ color: 'var(--accent)' }}>
            {overall}%
          </span>
          <button
            onClick={() => setReview(okrReview(objectives, period || undefined, i18n))}
            className="press rounded-md px-2 py-1 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
            title={t('okr.reviewTitle')}
          >
            {t('okr.reviewButton')}
          </button>
          {periods.length > 1 && (
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-8 rounded-lg bg-ink/40 px-2 font-mono text-[11px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('okr.periodFilterAria')}
            >
              <option value="">{t('okr.allPeriods')}</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {review !== null && (
        <div className="mt-3 rounded-xl bg-ink/40 px-4 py-3 ring-1 ring-inset ring-line">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
              {t('okr.reviewPanelTitle')}
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(review);
                } catch {
                  /* clipboard unavailable */
                }
              }}
              className="press font-mono text-[10px] text-sage hover:text-cream"
            >
              {t('okr.copy')}
            </button>
          </div>
          <pre className="mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-sage">
            {review}
          </pre>
          <button
            onClick={() => setReview(null)}
            className="press mt-1 font-mono text-[10px] text-faint hover:text-cream"
          >
            {t('okr.dismiss')}
          </button>
        </div>
      )}

      {roots.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] leading-relaxed text-faint">
          {t('okr.emptyLine1')}
          <br />
          {t('okr.emptyLine2')}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {roots.map((o) => (
            <ObjectiveNode
              key={o.id}
              objective={o}
              objectives={objectives}
              objectivesChange={objectivesChange}
              progressOf={progressOf}
              ancestorIds={[]}
            />
          ))}
        </ul>
      )}

      {!atCapacity ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              maxLength={120}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={t('okr.form.placeholder')}
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <button
              onClick={add}
              disabled={!draft.trim()}
              className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
              aria-label={t('okr.form.addAria')}
            >
              +
            </button>
          </div>
          {validParents.length > 0 && (
            <select
              value={draftParent}
              onChange={(e) => setDraftParent(e.target.value)}
              className="h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              aria-label={t('okr.form.parentAria')}
            >
              <option value="">{t('okr.form.noParent', { period: activePeriod })}</option>
              {validParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        !isPro && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
            <p className="text-[12px] leading-relaxed text-cream">
              {t('okr.capacityLine', { n: String(FREE_OKRS_LIMIT) })}
            </p>
            <p className="mt-1 font-mono text-[11px] text-faint">{t('okr.capacityUpgrade')}</p>
          </div>
        )
      )}

      {archived.length > 0 && (
        <div className="mt-3 border-t border-line/60 pt-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="press font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
          >
            {t('okr.archivedToggle', { n: String(archived.length) })} {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 opacity-70"
                >
                  <span className="truncate text-[13px] text-cream/80">{o.title}</span>
                  <button
                    onClick={() =>
                      objectivesChange(updateObjective(objectives, o.id, { archived: false }))
                    }
                    className="press shrink-0 font-mono text-[11px] text-faint hover:text-cream"
                  >
                    {t('okr.restore')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

interface NodeProps {
  objective: Objective;
  objectives: Objective[];
  objectivesChange: (objectives: Objective[]) => void;
  progressOf: Map<string, number>;
  ancestorIds: string[];
}

function ObjectiveNode({
  objective: o,
  objectives,
  objectivesChange,
  progressOf,
  ancestorIds,
}: NodeProps) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [krTitle, setKrTitle] = useState('');
  const [krTarget, setKrTarget] = useState('100');
  const [krUnit, setKrUnit] = useState('%');
  const pct = progressOf.get(o.id) ?? 0;
  const kids = childrenOf(objectives, o.id).filter((k) => !ancestorIds.includes(k.id));

  const addKr = () => {
    if (!krTitle.trim()) return;
    objectivesChange(addKeyResult(objectives, o.id, krTitle, Number(krTarget) || 100, krUnit));
    setKrTitle('');
  };

  return (
    <li>
      <div className="rounded-xl bg-ink/40 px-3.5 py-3 ring-1 ring-inset ring-line">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-cream hover:text-accent"
          >
            {o.title}
          </button>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-faint">
            {o.period}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="press shrink-0 rounded p-1 font-mono text-[11px] text-faint hover:text-cream"
            aria-label={showDetails ? t('okr.node.hideDetails') : t('okr.node.showDetails')}
          >
            ⋯
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
            }}
          />
        </div>

        {/* key results always visible — they ARE the objective */}
        {o.keyResults.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {o.keyResults.map((k) => {
              const kpct = Math.round(krProgress(k) * 100);
              return (
                <li key={k.id} className="rounded-lg bg-ink/50 px-2.5 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] text-cream/90">{k.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-sage">
                      {k.current}/{k.target}
                      {k.unit} · {kpct}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={k.target}
                      step={k.target > 100 ? Math.ceil(k.target / 100) : 1}
                      value={Math.min(k.current, k.target)}
                      onChange={(e) =>
                        objectivesChange(
                          updateKeyResult(objectives, o.id, k.id, {
                            current: Number(e.target.value),
                          }),
                        )
                      }
                      className="h-1.5 flex-1 accent-[var(--accent)]"
                      aria-label={t('okr.node.krProgressAria', { title: k.title })}
                    />
                    <button
                      onClick={() => {
                        if (confirm(t('okr.node.removeKrConfirm', { title: k.title }))) {
                          objectivesChange(removeKeyResult(objectives, o.id, k.id));
                        }
                      }}
                      className="press shrink-0 rounded p-0.5 font-mono text-[10px] text-faint hover:text-tomato"
                      aria-label={t('okr.node.removeKrAria', { title: k.title })}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {showDetails && (
          <div className="mt-2.5 space-y-2 border-t border-line/60 pt-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={krTitle}
                maxLength={120}
                onChange={(e) => setKrTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKr()}
                placeholder={t('okr.node.krPlaceholder')}
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/60 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
              />
              <input
                type="number"
                min={1}
                value={krTarget}
                onChange={(e) => setKrTarget(e.target.value)}
                className="h-8 w-20 shrink-0 rounded-lg bg-ink/60 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                title={t('okr.node.targetTitle')}
              />
              <input
                type="text"
                value={krUnit}
                maxLength={12}
                onChange={(e) => setKrUnit(e.target.value)}
                className="h-8 w-14 shrink-0 rounded-lg bg-ink/60 px-2 font-mono text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                title={t('okr.node.unitTitle')}
                placeholder="%"
              />
              <button
                onClick={addKr}
                disabled={!krTitle.trim()}
                className="press btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-base font-bold disabled:opacity-40"
                aria-label={t('okr.node.addKrAria')}
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  objectivesChange(updateObjective(objectives, o.id, { archived: true }))
                }
                className="press rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-cream"
              >
                {t('okr.node.archive')}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('okr.node.deleteConfirm', { title: o.title }))) {
                    objectivesChange(deleteObjective(objectives, o.id));
                  }
                }}
                className="press ml-auto rounded-lg px-2.5 py-1.5 text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato"
              >
                {t('okr.node.delete')}
              </button>
            </div>
          </div>
        )}
      </div>
      {kids.length > 0 && (
        <ul className="ml-4 mt-2 space-y-2 border-l-2 border-line/50 pl-2">
          {kids.map((k) => (
            <ObjectiveNode
              key={k.id}
              objective={k}
              objectives={objectives}
              objectivesChange={objectivesChange}
              progressOf={progressOf}
              ancestorIds={[...ancestorIds, o.id]}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
