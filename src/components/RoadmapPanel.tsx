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
    <div className="mono-item mono-stack">
      <p className="mono-eyebrow" style={{ margin: 0 }}>
        {t('assist.roadmap.kicker')}
      </p>

      <div className="mono-inline" role="group" aria-label={t('assist.roadmap.groups')}>
        {ROADMAP_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => pickGroup(g)}
            aria-pressed={group === g}
            className="mono-chip mono-chip-sm"
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
        aria-label={t('assist.roadmap.goalPh')}
        className="mono-field"
        style={{ resize: 'vertical' }}
      />

      <div className="mono-inline">
        <label className="mono-row mono-caption" style={{ gap: 8 }}>
          {t('assist.roadmap.hoursWeek')}
          <input
            type="number"
            min={1}
            max={40}
            value={hoursPerWeek}
            onChange={(e) =>
              setHoursPerWeek(Math.min(40, Math.max(1, Number(e.target.value) || 1)))
            }
            className="mono-field mono-field-sm mono-field-auto"
            style={{ width: 72 }}
          />
        </label>
        <button
          type="button"
          onClick={build}
          disabled={busy || !goal.trim()}
          className="mono-btn mono-btn-primary mono-btn-sm"
        >
          {busy ? t('assist.roadmap.building') : t('assist.roadmap.build')}
        </button>
      </div>

      <details className="mono-set-group">
        <summary className="mono-set-summary" style={{ minHeight: 44, padding: '8px 12px' }}>
          <span className="mono-caption" style={{ flex: 1 }}>
            {t('assist.roadmap.aiSettings')}
          </span>
          <span className="mono-tpl-chev" aria-hidden="true">
            ›
          </span>
        </summary>
        <div className="mono-set-body mono-stack" style={{ padding: '0 12px 12px' }}>
          {!byokOk ? <p className="mono-caption">{t('assist.roadmap.byokPro')}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="mono-stack mono-caption" style={{ gap: 4 }}>
              {t('assist.roadmap.provider')}
              <select
                value={byokOk ? cfg.provider : 'local'}
                disabled={!byokOk}
                onChange={(e) => persistCfg({ ...cfg, provider: e.target.value as ByokProvider })}
                className="mono-field mono-field-sm"
              >
                {(byokOk ? BYOK_PROVIDERS : (['local'] as ByokProvider[])).map((p) => (
                  <option key={p} value={p}>
                    {t(PROVIDER_KEY[p])}
                  </option>
                ))}
              </select>
            </label>
            <label className="mono-stack mono-caption" style={{ gap: 4 }}>
              {t('assist.roadmap.apiKey')}
              <input
                type="password"
                autoComplete="off"
                value={cfg.key}
                disabled={!byokOk || cfg.provider === 'local'}
                onChange={(e) => persistCfg({ ...cfg, key: e.target.value })}
                placeholder={t('assist.roadmap.apiKeyPh')}
                className="mono-field mono-field-sm"
              />
            </label>
          </div>
          {byokOk && cfg.provider !== 'local' ? (
            <p className="mono-caption">{t('assist.roadmap.keyHint')}</p>
          ) : null}
          <label className="mono-row mono-caption" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={byokOk && cfg.webSearch}
              disabled={!byokOk || cfg.provider !== 'gemini'}
              onChange={(e) => persistCfg({ ...cfg, webSearch: e.target.checked })}
            />
            {t('assist.roadmap.webSearch')}
            {!byokOk || cfg.provider !== 'gemini' ? (
              <span>({t('assist.roadmap.webSearchHint')})</span>
            ) : null}
          </label>
        </div>
      </details>

      {status ? <p className="mono-caption">{status}</p> : null}

      {draftPath ? (
        <div className="mono-note mono-stack">
          <p style={{ fontWeight: 600 }}>{t('assist.roadmap.draft')}</p>
          <ul className="mono-stack" style={{ gap: 4 }}>
            {draftPath.tasks.slice(0, 12).map((task) => (
              <li key={task.draftId}>
                {task.title}{' '}
                <span className="mono-caption" style={{ display: 'inline' }}>
                  ({fmtNum(task.pomodoros * 25)}m)
                </span>
              </li>
            ))}
          </ul>
          <div className="mono-inline">
            <button
              type="button"
              onClick={approveDraft}
              className="mono-btn mono-btn-primary mono-btn-sm"
            >
              {t('assist.roadmap.approve')}
            </button>
            <button
              type="button"
              onClick={() => setDraftPath(null)}
              className="mono-btn mono-btn-ghost mono-btn-sm"
            >
              {t('assist.roadmap.discard')}
            </button>
          </div>
        </div>
      ) : null}

      {roadmap ? (
        <div
          className="mono-stack"
          style={{ paddingTop: 12, borderTop: '1px solid var(--mono-border)' }}
        >
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
              <p className="mono-h3">{roadmap.title}</p>
              {eta ? (
                <p className="mono-caption">
                  {t('assist.roadmap.etaShort', {
                    days: fmtNum(eta.daysLeft),
                    pace: fmtNum(eta.paceMinPerDay),
                  })}
                </p>
              ) : null}
              <p className="mono-caption" style={{ marginTop: 4, color: 'var(--mono-accent)' }}>
                {next
                  ? t('assist.roadmap.next', { step: next.title })
                  : t('assist.roadmap.stripDone')}
              </p>
            </div>
          </div>

          <RoadmapJourneyTrack steps={roadmap.steps} />

          <div className="mono-inline">
            <label className="mono-row mono-caption" style={{ gap: 8 }}>
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
                className="mono-field mono-field-sm mono-field-auto"
                style={{ width: 80 }}
              />
            </label>
            {roadmap.projectId && onWorkFocus ? (
              <button
                type="button"
                className="mono-btn mono-btn-primary mono-btn-sm"
                onClick={() => onWorkFocus(roadmap.projectId!, next?.taskId ?? null)}
              >
                {t('assist.roadmap.openFocus')}
              </button>
            ) : null}
          </div>

          <RoadmapJourneyTrail steps={roadmap.steps}>
            {(step) => (
              <div className="mono-item mono-row" style={{ gap: 8, padding: '6px 10px' }}>
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) =>
                    onRoadmapChange(updateStep(roadmap, step.id, { done: e.target.checked }))
                  }
                  aria-label={step.title}
                  style={{ accentColor: 'var(--mono-accent)' }}
                />
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) =>
                    onRoadmapChange(updateStep(roadmap, step.id, { title: e.target.value }))
                  }
                  className="mono-field mono-field-sm"
                  style={{ flex: 1, minWidth: 0, background: 'transparent' }}
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
                  className="mono-field mono-field-sm mono-field-auto"
                  style={{ width: 72 }}
                  title={t('assist.roadmap.stepMin')}
                  aria-label={t('assist.roadmap.stepMin')}
                />
                <button
                  type="button"
                  aria-label={t('assist.roadmap.moveUp')}
                  className="mono-link-btn"
                  style={{ textDecoration: 'none' }}
                  onClick={() => onRoadmapChange(moveStep(roadmap, step.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t('assist.roadmap.moveDown')}
                  className="mono-link-btn"
                  style={{ textDecoration: 'none' }}
                  onClick={() => onRoadmapChange(moveStep(roadmap, step.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={t('assist.roadmap.deleteStep')}
                  className="mono-link-btn"
                  style={{ textDecoration: 'none', color: 'var(--mono-danger)' }}
                  onClick={() => onRoadmapChange(removeStep(roadmap, step.id))}
                >
                  ×
                </button>
              </div>
            )}
          </RoadmapJourneyTrail>

          <div className="mono-row" style={{ gap: 8 }}>
            <input
              type="text"
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder={t('assist.roadmap.addStep')}
              aria-label={t('assist.roadmap.addStep')}
              className="mono-field mono-field-sm"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              aria-label={t('assist.roadmap.addStep')}
              className="mono-btn mono-btn-ghost mono-btn-sm"
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
