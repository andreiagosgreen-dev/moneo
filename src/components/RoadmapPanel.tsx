import { useState } from 'react';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  BYOK_PROVIDERS,
  buildByokPath,
  loadByokConfig,
  saveByokConfig,
  type ByokConfig,
  type ByokProvider,
} from '../lib/ai/byok';
import {
  ROADMAP_GROUPS,
  addStep,
  groupDefaultHorizonMonths,
  groupPreferredKind,
  groupStarterKey,
  moveStep,
  nextOpenStep,
  removeStep,
  roadmapEta,
  roadmapFromBuiltPath,
  roadmapProgress,
  setPlannedPace,
  updateStep,
  type Roadmap,
  type RoadmapGroup,
} from '../lib/ai/roadmap';
import { canUseByokAi } from '../lib/billing/pricingConfig';
import type { BuiltPath } from '../lib/ai/types';
import { materializeBuiltPath } from '../lib/ai/pathText';
import {
  RoadmapJourneyTrack,
  RoadmapJourneyTrail,
  RoadmapProgressRing,
} from '../mono/RoadmapJourney';

const GROUP_KEY: Record<RoadmapGroup, TKey> = {
  learn: 'assist.roadmap.group.learn',
  build: 'assist.roadmap.group.build',
  ship: 'assist.roadmap.group.ship',
  market: 'assist.roadmap.group.market',
  write: 'assist.roadmap.group.write',
  life: 'assist.roadmap.group.life',
  custom: 'assist.roadmap.group.custom',
};

const PROVIDER_KEY: Record<ByokProvider, TKey> = {
  local: 'assist.roadmap.provider.local',
  gemini: 'assist.roadmap.provider.gemini',
  openai: 'assist.roadmap.provider.openai',
  deepseek: 'assist.roadmap.provider.deepseek',
};

interface Props {
  roadmap: Roadmap | null;
  onRoadmapChange: (r: Roadmap | null) => void;
  onApprove: (r: Roadmap) => void;
  onWorkFocus?: (projectId: string, taskId: string | null) => void;
  onAddStep?: (title: string) => void;
  /** Pro unlocks own-key AI providers. Free = local planner only. */
  isPro?: boolean;
}

/** Topic chips + optional AI settings + plan editor. */
export default function RoadmapPanel({
  roadmap,
  onRoadmapChange,
  onApprove,
  onWorkFocus,
  onAddStep,
  isPro = false,
}: Props) {
  const { t, fmtNum } = useI18n();
  const byokOk = canUseByokAi(isPro);
  const [cfg, setCfg] = useState<ByokConfig>(() => {
    const loaded = loadByokConfig();
    return byokOk ? loaded : { ...loaded, provider: 'local', webSearch: false };
  });
  const [group, setGroup] = useState<RoadmapGroup>('learn');
  const [goal, setGoal] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [busy, setBusy] = useState(false);
  const [draftPath, setDraftPath] = useState<BuiltPath | null>(null);
  const [draftSources, setDraftSources] = useState<string[]>([]);
  const [draftProvider, setDraftProvider] = useState<ByokProvider | 'local-fallback'>('local');
  const [status, setStatus] = useState('');
  const [newStep, setNewStep] = useState('');

  const persistCfg = (next: ByokConfig) => {
    const safe = byokOk ? next : { ...next, provider: 'local' as const, webSearch: false };
    setCfg(safe);
    saveByokConfig(safe);
  };

  const pickGroup = (g: RoadmapGroup) => {
    setGroup(g);
    const key = groupStarterKey(g);
    setGoal(key ? t(key) : '');
  };

  const build = async () => {
    const text = goal.trim();
    if (!text || busy) return;
    setBusy(true);
    setStatus('');
    setDraftPath(null);
    const preferred = groupPreferredKind(group);
    const effective: ByokConfig = byokOk ? cfg : { ...cfg, provider: 'local', webSearch: false };
    const result = await buildByokPath(
      {
        text,
        horizonMonths: groupDefaultHorizonMonths(group),
        hoursPerWeek,
        level: 'beginner',
        ...(preferred ? { kind: preferred } : {}),
      },
      effective,
    );
    setBusy(false);
    if (!result.ok || !result.path) {
      setStatus(t('assist.roadmap.buildFail'));
      return;
    }
    const readable = materializeBuiltPath(result.path, (key, vars) => t(key as TKey, vars));
    setDraftPath(readable);
    setDraftSources(result.sources ?? []);
    setDraftProvider(result.used);
    setStatus(result.used === 'local-fallback' ? t('assist.roadmap.fallback') : '');
  };

  const approveDraft = () => {
    if (!draftPath) return;
    const r = roadmapFromBuiltPath(
      draftPath,
      group,
      draftProvider,
      draftSources,
      Math.max(25, Math.round((hoursPerWeek * 60) / 5)),
    );
    // Parent gates Free limits and commits; keep draft until Start is accepted.
    onApprove(r);
    setDraftPath(null);
  };

  const eta = roadmap ? roadmapEta(roadmap) : null;
  const next = roadmap ? nextOpenStep(roadmap) : null;
  const pct = roadmap ? roadmapProgress(roadmap) : 0;
  const doneCount = roadmap ? roadmap.steps.filter((s) => s.done).length : 0;

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-ink/30 px-3 py-3 ring-1 ring-line">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        {t('assist.roadmap.kicker')}
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('assist.roadmap.groups')}>
        {ROADMAP_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => pickGroup(g)}
            className={`press rounded-full px-2.5 py-1 font-mono text-[11px] ring-1 ring-inset ${
              group === g
                ? 'bg-accent/20 text-cream ring-accent/50'
                : 'text-sage ring-line hover:text-cream'
            }`}
          >
            {t(GROUP_KEY[g])}
          </button>
        ))}
      </div>

      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={t('assist.roadmap.goalPh')}
        className="w-full resize-y rounded-lg bg-ink/40 px-3 py-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12px] text-sage">
          {t('assist.roadmap.hoursWeek')}
          <input
            type="number"
            min={1}
            max={40}
            value={hoursPerWeek}
            onChange={(e) =>
              setHoursPerWeek(Math.min(40, Math.max(1, Number(e.target.value) || 1)))
            }
            className="h-8 w-16 rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line"
          />
        </label>
        <button
          type="button"
          onClick={build}
          disabled={busy || !goal.trim()}
          className="press btn-accent rounded-lg px-3 py-2 text-[12px] font-semibold disabled:opacity-40"
        >
          {busy ? t('assist.roadmap.building') : t('assist.roadmap.build')}
        </button>
      </div>

      <details className="rounded-lg bg-ink/20 px-2 py-1.5 ring-1 ring-inset ring-line/60">
        <summary className="cursor-pointer font-mono text-[11px] text-sage hover:text-cream">
          {t('assist.roadmap.aiSettings')}
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          {!byokOk ? <p className="text-[11px] text-faint">{t('assist.roadmap.byokPro')}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-[11px] text-sage">
              {t('assist.roadmap.provider')}
              <select
                value={byokOk ? cfg.provider : 'local'}
                disabled={!byokOk}
                onChange={(e) => persistCfg({ ...cfg, provider: e.target.value as ByokProvider })}
                className="mt-1 h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none disabled:opacity-50"
              >
                {(byokOk ? BYOK_PROVIDERS : (['local'] as ByokProvider[])).map((p) => (
                  <option key={p} value={p}>
                    {t(PROVIDER_KEY[p])}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px] text-sage">
              {t('assist.roadmap.apiKey')}
              <input
                type="password"
                autoComplete="off"
                value={cfg.key}
                disabled={!byokOk || cfg.provider === 'local'}
                onChange={(e) => persistCfg({ ...cfg, key: e.target.value })}
                placeholder={t('assist.roadmap.apiKeyPh')}
                className="mt-1 h-9 w-full rounded-lg bg-ink/40 px-2 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
          {byokOk && cfg.provider !== 'local' ? (
            <p className="text-[11px] text-faint">{t('assist.roadmap.keyHint')}</p>
          ) : null}
          <label className="flex items-center gap-2 text-[12px] text-sage">
            <input
              type="checkbox"
              checked={byokOk && cfg.webSearch}
              disabled={!byokOk || cfg.provider !== 'gemini'}
              onChange={(e) => persistCfg({ ...cfg, webSearch: e.target.checked })}
            />
            {t('assist.roadmap.webSearch')}
            {!byokOk || cfg.provider !== 'gemini' ? (
              <span className="text-faint">({t('assist.roadmap.webSearchHint')})</span>
            ) : null}
          </label>
        </div>
      </details>

      {status ? <p className="text-[12px] text-sage">{status}</p> : null}

      {draftPath ? (
        <div className="space-y-2 rounded-lg bg-ink/40 px-3 py-2 ring-1 ring-inset ring-accent/30">
          <p className="text-[12px] font-semibold text-cream">{t('assist.roadmap.draft')}</p>
          <ul className="space-y-1 text-[12px] text-sage">
            {draftPath.tasks.slice(0, 12).map((task) => (
              <li key={task.draftId}>
                {task.title} <span className="text-faint">({fmtNum(task.pomodoros * 25)}m)</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={approveDraft}
              className="press btn-accent rounded-lg px-3 py-1.5 text-[12px] font-semibold"
            >
              {t('assist.roadmap.approve')}
            </button>
            <button
              type="button"
              onClick={() => setDraftPath(null)}
              className="press rounded-lg px-3 py-1.5 text-[12px] text-sage ring-1 ring-inset ring-line"
            >
              {t('assist.roadmap.discard')}
            </button>
          </div>
        </div>
      ) : null}

      {roadmap ? (
        <div className="space-y-3 border-t border-line/60 pt-3">
          <div className="mono-rm-hero">
            <RoadmapProgressRing
              pct={pct}
              label={t('assist.roadmap.stepsDone', {
                done: fmtNum(doneCount),
                total: fmtNum(roadmap.steps.length),
              })}
              size={52}
            />
            <div className="mono-rm-hero-meta">
              <p className="text-[14px] font-semibold text-cream">{roadmap.title}</p>
              {eta ? (
                <p className="text-[11px] text-sage">
                  {t('assist.roadmap.etaShort', {
                    days: fmtNum(eta.daysLeft),
                    pace: fmtNum(eta.paceMinPerDay),
                  })}
                </p>
              ) : null}
              <p className="mt-1 text-[12px] text-accent">
                {next
                  ? t('assist.roadmap.next', { step: next.title })
                  : t('assist.roadmap.stripDone')}
              </p>
            </div>
          </div>

          <RoadmapJourneyTrack steps={roadmap.steps} />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-sage">
              {t('assist.roadmap.pace')}
              <input
                type="number"
                min={5}
                max={480}
                value={roadmap.plannedMinPerDay}
                onChange={(e) =>
                  onRoadmapChange(
                    setPlannedPace(roadmap, Number(e.target.value) || roadmap.plannedMinPerDay),
                  )
                }
                className="h-7 w-14 rounded bg-ink/40 px-1 text-cream ring-1 ring-inset ring-line"
              />
            </label>
            {roadmap.projectId && onWorkFocus ? (
              <button
                type="button"
                className="press rounded-md px-2 py-1 font-mono text-[11px] text-accent ring-1 ring-inset ring-accent/40"
                onClick={() => onWorkFocus(roadmap.projectId!, next?.taskId ?? null)}
              >
                {t('assist.roadmap.openFocus')}
              </button>
            ) : null}
          </div>

          <RoadmapJourneyTrail steps={roadmap.steps}>
            {(step) => (
              <div className="flex items-start gap-2 rounded-lg bg-ink/40 px-2 py-1.5 ring-1 ring-inset ring-line">
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) =>
                    onRoadmapChange(updateStep(roadmap, step.id, { done: e.target.checked }))
                  }
                  className="mt-1"
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) =>
                    onRoadmapChange(updateStep(roadmap, step.id, { title: e.target.value }))
                  }
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-cream focus:outline-none"
                />
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={step.estimateMin}
                  onChange={(e) =>
                    onRoadmapChange(
                      updateStep(roadmap, step.id, {
                        estimateMin: Number(e.target.value) || step.estimateMin,
                      }),
                    )
                  }
                  className="h-7 w-14 rounded bg-ink/50 px-1 text-[11px] text-cream ring-1 ring-inset ring-line"
                  title={t('assist.roadmap.stepMin')}
                />
                <button
                  type="button"
                  aria-label={t('assist.roadmap.moveUp')}
                  className="text-[11px] text-sage"
                  onClick={() => onRoadmapChange(moveStep(roadmap, step.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('assist.roadmap.moveDown')}
                  className="text-[11px] text-sage"
                  onClick={() => onRoadmapChange(moveStep(roadmap, step.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('assist.roadmap.deleteStep')}
                  className="text-[11px] text-tomato"
                  onClick={() => onRoadmapChange(removeStep(roadmap, step.id))}
                >
                  ×
                </button>
              </div>
            )}
          </RoadmapJourneyTrail>

          <div className="flex gap-2">
            <input
              type="text"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder={t('assist.roadmap.addStep')}
              className="h-8 min-w-0 flex-1 rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line"
            />
            <button
              type="button"
              className="press rounded-lg px-2 text-[12px] text-cream ring-1 ring-inset ring-line"
              onClick={() => {
                if (!newStep.trim()) return;
                if (onAddStep) onAddStep(newStep.trim());
                else onRoadmapChange(addStep(roadmap, newStep.trim()));
                setNewStep('');
              }}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
