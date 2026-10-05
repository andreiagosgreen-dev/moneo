import { useMemo, useState } from 'react';
import {
  buildPath,
  draftWeek,
  neededInputs,
  resolveInput,
  MAX_DRAFT_TASKS,
  POMODORO_MIN,
} from '../lib/ai/planner';
import { buildSprint, type BuiltSprint } from '../lib/ai/sprint';
import { loadAIConsent, saveAIConsent } from '../lib/ai/providers';
import { withRound } from '../lib/ai/pathText';
import type { BuiltPath, ClarifyId, PathInput, SkillLevel } from '../lib/ai/types';
import {
  createProjectObject,
  FREE_PROJECTS_LIMIT,
  type Project,
  type ProjectCategory,
} from '../lib/projects';
import { createTaskObject, setTaskEstimate, type Task } from '../lib/tasks';
import { createGoalObject, type Goal } from '../lib/goals';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { weekdayOfKey, type TimeBlock, type Weekday } from '../lib/timeBlocks';
import { dayCapacity, nextDayKey } from '../lib/ritual';
import { dayKeyInTz } from '../lib/timezone';
import type { WaterfallPhase } from '../lib/waterfall';
import { seedWaterfallForPathKind } from '../lib/ai/approvePath';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  projects: Project[];
  projectsChange: (projects: Project[]) => void;
  tasks: Task[];
  tasksChange: (tasks: Task[]) => void;
  goals: Goal[];
  goalsChange: (goals: Goal[]) => void;
  ivyPlans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  blocks: TimeBlock[];
  phases?: WaterfallPhase[];
  phasesChange?: (phases: WaterfallPhase[]) => void;
  timezone: string;
  isPro?: boolean;
}

type Mode = 'goal' | 'sprint';
type Step = 'input' | 'questions' | 'roadmap' | 'done';

const HORIZONS = [1, 3, 6, 12, 36, 60, 120, 480];
const LEVELS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];

/**
 * "Build my path" (Faza 6): big goal in → visual road map out → explicit
 * approval before anything is created. Bounded by construction: at most
 * one project and MAX_DRAFT_TASKS tasks per approval, week drafts never
 * overfill a day. Local engine; nothing leaves the device.
 */
export default function AiPathCard({
  projects,
  projectsChange,
  tasks,
  tasksChange,
  goals,
  goalsChange,
  ivyPlans,
  plansChange,
  blocks,
  phases = [],
  phasesChange,
  timezone,
  isPro = false,
}: Props) {
  const { t, tp } = useI18n();
  const [mode, setMode] = useState<Mode>('goal');
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [horizon, setHorizon] = useState<number | null>(null);
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [path, setPath] = useState<BuiltPath | null>(null);
  const [sprint, setSprint] = useState<BuiltSprint | null>(null);
  const [createProject, setCreateProject] = useState(true);
  const [draftIntoWeek, setDraftIntoWeek] = useState(true);
  const [consent, setConsent] = useState(loadAIConsent);
  const [resultNote, setResultNote] = useState('');

  const maxIvy = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
  const todayKey = dayKeyInTz(Date.now(), timezone);

  const questions: ClarifyId[] = useMemo(
    () =>
      neededInputs({
        text,
        horizonMonths: horizon ?? undefined,
        level: level ?? undefined,
        hoursPerWeek: hours ?? undefined,
      }),
    [text, horizon, level, hours],
  );

  const readyInput: PathInput = {
    text,
    horizonMonths: horizon ?? undefined,
    level: level ?? undefined,
    hoursPerWeek: hours ?? undefined,
  };

  const startBuild = () => {
    if (!text.trim()) return;
    if (mode === 'sprint') {
      setSprint(buildSprint({ skill: text, hoursPerWeek: hours ?? 5 }));
      setStep('roadmap');
      return;
    }
    if (questions.length > 0) {
      setStep('questions');
      return;
    }
    setPath(buildPath(resolveInput(readyInput)));
    setStep('roadmap');
  };

  const answerAndBuild = () => {
    setPath(buildPath(resolveInput(readyInput)));
    setStep('roadmap');
  };

  const weekCapacities = useMemo(() => {
    let key = todayKey;
    const caps: number[] = [];
    for (let d = 0; d < 7; d++) {
      caps.push(dayCapacity(blocks, weekdayOfKey(key) as Weekday));
      key = nextDayKey(key);
    }
    return caps;
  }, [blocks, todayKey]);

  const approve = () => {
    if (!path && !sprint) return;
    const summary: string[] = [];
    let accTasks = tasks;
    let accProjects = projects;

    // Frame ids become real text here (two-pass: outcome first, then tasks).
    const outcomeText = (phaseId: string): string => {
      const phase = path?.phases.find((p) => p.id === phaseId);
      return phase ? t(phase.outcome as TKey, { goal: path!.goal }) : '';
    };
    const taskPhase = (milestoneId: string): string =>
      path?.milestones.find((m) => m.id === milestoneId)?.phaseId ?? '';
    const taskText = (frame: string, milestoneId: string, round?: number): string =>
      withRound(
        t(frame as TKey, { goal: path?.goal ?? '', outcome: outcomeText(taskPhase(milestoneId)) }),
        round,
        (key, vars) => t(key as TKey, vars),
      );

    const planned =
      path?.tasks.map((x) => ({
        title: taskText(x.title, x.milestoneId, x.round),
        pomodoros: x.pomodoros,
        priority: x.priority,
      })) ??
      sprint!.subskillFrames.map((f) => ({
        title: t(f as TKey, { skill: sprint!.skill }),
        pomodoros: 2,
        priority: 'p2' as const,
      }));

    let projectId: string | null = null;
    if (createProject) {
      if (!isPro && projects.length >= FREE_PROJECTS_LIMIT) {
        setResultNote(t('proj.limit', { n: FREE_PROJECTS_LIMIT }));
        setStep('done');
        return;
      }
      const name =
        path != null
          ? `${t('ai.approve.projectPrefix')}${path.goal}`
          : `${t('ai.approve.sprintPrefix')}${sprint!.skill}`;
      const category: ProjectCategory = path?.kind === 'launch' ? 'work' : 'learning';
      const project = createProjectObject(name.slice(0, 60), category);
      projectId = project.id;
      accProjects = [...accProjects, project];
      projectsChange(accProjects);
      summary.push(t('ai.done.project', { name: project.name }));

      // Link a real Goal to the new project so its long-term progress
      // rolls up through the existing goalProgress() mechanism instead of
      // disappearing once the plan is approved.
      const goal = createGoalObject(goals, project.name, 'project');
      if (goal) goalsChange([...goals, { ...goal, projectId: project.id }]);

      if (path && phasesChange) {
        phasesChange(seedWaterfallForPathKind(phases, project.id, path.kind));
      }
    }

    // title → real Task id, so week-drafted Ivy entries (below) can carry
    // a genuine taskId instead of a plain string.
    const taskIdByTitle = new Map<string, string>();
    if (projectId) {
      for (const item of planned.slice(0, MAX_DRAFT_TASKS)) {
        const task = createTaskObject(projectId, item.title, item.priority);
        taskIdByTitle.set(item.title, task.id);
        accTasks = [...accTasks, task];
        accTasks = setTaskEstimate(accTasks, task.id, item.pomodoros * POMODORO_MIN);
      }
      tasksChange(accTasks);
      summary.push(tp('ai.done.tasks', Math.min(planned.length, MAX_DRAFT_TASKS)));
    }

    if (draftIntoWeek && path) {
      const draft = draftWeek(
        planned.map((x) => ({ title: x.title, pomodoros: x.pomodoros })),
        todayKey,
        weekCapacities,
      );
      let acc = ivyPlans;
      let placed = 0;
      let key = todayKey;
      for (const day of draft.days) {
        for (const item of day.items) {
          // Estimate straight from the draft (planned carries pomodoros) —
          // never from pre-approval state, which lacks the new tasks.
          const res = addTaskToDay(
            acc,
            key,
            item.title,
            maxIvy,
            item.pomodoros * POMODORO_MIN,
            taskIdByTitle.get(item.title),
          );
          acc = res.plans;
          if (res.added) placed += 1;
        }
        key = nextDayKey(key);
      }
      plansChange(acc);
      summary.push(
        draft.unscheduled.length > 0
          ? t('ai.done.weekPartial', { placed, left: draft.unscheduled.length })
          : t('ai.done.weekFull', { placed }),
      );
    }

    setResultNote(summary.join(' · '));
    setStep('done');
  };

  const toggleConsent = () => {
    const next = { autoPrepare: !consent.autoPrepare, at: Date.now() };
    setConsent(next);
    saveAIConsent(next);
  };

  const reset = () => {
    setStep('input');
    setPath(null);
    setSprint(null);
    setResultNote('');
  };

  return (
    <section className="mono-card mono-panel" aria-label={t('ai.title')}>
      <header className="mono-panel-head">
        <p className="mono-eyebrow" style={{ margin: '0 0 6px' }}>
          {t('ai.kicker')}
        </p>
        <h2 className="mono-h2">{t('ai.title')}</h2>
        <p className="mono-meta" style={{ maxWidth: '42rem' }}>
          {t('ai.subtitle')}
        </p>
      </header>

      <div className="mono-inline" role="group" aria-label={t('ai.modeAria')}>
        {(['goal', 'sprint'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              reset();
            }}
            aria-pressed={mode === m}
            className="mono-chip mono-chip-sm"
          >
            {t(m === 'goal' ? 'ai.modeGoal' : 'ai.modeSprint')}
          </button>
        ))}
      </div>

      {step === 'input' && (
        <div className="mono-stack">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t(mode === 'goal' ? 'ai.goalPh' : 'ai.skillPh')}
            aria-label={t(mode === 'goal' ? 'ai.goalAria' : 'ai.skillAria')}
            className="mono-field"
            style={{ resize: 'vertical' }}
          />
          <div className="mono-row" style={{ justifyContent: 'flex-end' }}>
            <button
              onClick={startBuild}
              disabled={!text.trim()}
              className="mono-btn mono-btn-primary mono-btn-sm"
            >
              {t(mode === 'goal' ? 'ai.build' : 'ai.buildSprint')}
            </button>
          </div>
        </div>
      )}

      {step === 'questions' && (
        <div className="mono-stack" style={{ gap: 14 }}>
          <p className="mono-h3">{t('ai.questionsTitle')}</p>
          {questions.includes('horizon') && (
            <div className="mono-stack" style={{ gap: 6 }}>
              <p className="mono-caption">{t('ai.q.horizon')}</p>
              <div className="mono-inline" style={{ gap: 6 }}>
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    aria-pressed={horizon === h}
                    className="mono-chip mono-chip-sm"
                  >
                    {h >= 480
                      ? t('ai.q.life')
                      : h >= 12
                        ? tp('ai.q.years', Math.round(h / 12))
                        : tp('ai.q.months', h)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {questions.includes('level') && (
            <div className="mono-stack" style={{ gap: 6 }}>
              <p className="mono-caption">{t('ai.q.level')}</p>
              <div className="mono-inline" style={{ gap: 6 }}>
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    aria-pressed={level === l}
                    className="mono-chip mono-chip-sm"
                  >
                    {t(`ai.q.level.${l}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {questions.includes('hours') && (
            <div className="mono-stack" style={{ gap: 6 }}>
              <p className="mono-caption">{t('ai.q.hours')}</p>
              <div className="mono-inline" style={{ gap: 6 }}>
                {[2, 5, 8, 12].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    aria-pressed={hours === h}
                    className="mono-chip mono-chip-sm"
                  >
                    {t('ai.q.hoursPerWeek', { n: h })}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mono-row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => setStep('input')}
              className="mono-btn mono-btn-ghost mono-btn-sm"
            >
              {t('morning.back')}
            </button>
            <button onClick={answerAndBuild} className="mono-btn mono-btn-primary mono-btn-sm">
              {t('ai.showPath')}
            </button>
          </div>
        </div>
      )}

      {step === 'roadmap' && (path || sprint) && (
        <RoadmapView
          path={path}
          sprint={sprint}
          createProject={createProject}
          onCreateProject={setCreateProject}
          draftIntoWeek={draftIntoWeek}
          onDraftIntoWeek={setDraftIntoWeek}
          consent={consent.autoPrepare}
          onConsent={toggleConsent}
          onApprove={approve}
          onBack={reset}
        />
      )}

      {step === 'done' && (
        <div className="mono-item mono-stack" style={{ gap: 6 }}>
          <p className="mono-h3">{t('ai.done.title')}</p>
          <p className="mono-meta">{resultNote}</p>
          <p className="mono-caption">{t('ai.done.hint')}</p>
          <div className="mono-row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={reset} className="mono-btn mono-btn-ghost mono-btn-sm">
              {t('ai.done.again')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RoadmapView({
  path,
  sprint,
  createProject,
  onCreateProject,
  draftIntoWeek,
  onDraftIntoWeek,
  consent,
  onConsent,
  onApprove,
  onBack,
}: {
  path: BuiltPath | null;
  sprint: BuiltSprint | null;
  createProject: boolean;
  onCreateProject: (v: boolean) => void;
  draftIntoWeek: boolean;
  onDraftIntoWeek: (v: boolean) => void;
  consent: boolean;
  onConsent: () => void;
  onApprove: () => void;
  onBack: () => void;
}) {
  const { t, tp } = useI18n();
  const outcomeText = (phaseId: string): string => {
    const phase = path?.phases.find((p) => p.id === phaseId);
    return phase ? t(phase.outcome as TKey, { goal: path?.goal ?? '' }) : '';
  };
  const phaseOfTask = (milestoneId: string): string =>
    path?.milestones.find((m) => m.id === milestoneId)?.phaseId ?? '';
  return (
    <div className="mono-stack">
      <p className="mono-caption">{t('ai.draftKicker')}</p>

      {path && (
        <>
          <ul className="mono-stack">
            {path.phases.map((phase) => (
              <li key={phase.id} className="mono-item">
                <div className="mono-between" style={{ gap: 8, alignItems: 'baseline' }}>
                  <p className="mono-h3">{t(phase.outcome as TKey, { goal: path.goal })}</p>
                  <p className="mono-caption" style={{ flexShrink: 0 }}>
                    {t('ai.phase.months', { a: phase.months[0], b: phase.months[1] })}
                  </p>
                </div>
                <ul className="mono-stack" style={{ gap: 4, marginTop: 6 }}>
                  {path.milestones
                    .filter((m) => m.phaseId === phase.id)
                    .map((m) => (
                      <li key={m.id} className="mono-meta" style={{ fontSize: 14.5 }}>
                        ◆ {t(m.title as TKey, { outcome: outcomeText(m.phaseId) })}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
          <details className="mono-set-group">
            <summary className="mono-set-summary" style={{ minHeight: 44, padding: '8px 12px' }}>
              <span className="mono-caption" style={{ flex: 1 }}>
                {tp('ai.draft.tasks', path.tasks.length, { n: path.totalPomodoros })}
              </span>
              <span className="mono-tpl-chev" aria-hidden="true">
                ›
              </span>
            </summary>
            <ul
              className="mono-stack mono-set-body"
              style={{ gap: 6, maxHeight: '14rem', overflowY: 'auto', padding: '0 12px 12px' }}
            >
              {path.tasks.map((x) => (
                <li key={x.draftId} className="mono-between" style={{ gap: 8 }}>
                  <span className="mono-meta" style={{ fontSize: 14.5, minWidth: 0 }}>
                    {withRound(
                      t(x.title as TKey, {
                        goal: path.goal,
                        outcome: outcomeText(phaseOfTask(x.milestoneId)),
                      }),
                      x.round,
                      (key, vars) => t(key as TKey, vars),
                    )}
                  </span>
                  <span className="mono-caption" style={{ flexShrink: 0 }}>
                    ~{x.pomodoros}🍅
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {path.assumptions.map((a) => (
            <p key={a} className="mono-caption">
              {t(a === 'trimmed-to-20' ? 'ai.assume.trimmed' : 'ai.assume.capacity')}
            </p>
          ))}
        </>
      )}

      {sprint && (
        <>
          <div className="mono-item">
            <p className="mono-h3">{t(sprint.outcomeFrame as TKey, sprint.outcomeVars)}</p>
            <p className="mono-caption">
              {t('ai.sprint.meta', { weeks: sprint.weeks, pomodoros: sprint.totalPomodoros })}
            </p>
            <ul className="mono-stack" style={{ gap: 4, marginTop: 8 }}>
              {sprint.subskillFrames.map((f) => (
                <li key={f} className="mono-meta" style={{ fontSize: 14.5 }}>
                  ◆ {t(f as TKey, { skill: sprint.skill })}
                </li>
              ))}
            </ul>
            <ul
              className="mono-stack"
              style={{
                gap: 4,
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--mono-border)',
              }}
            >
              {sprint.checkpoints.map((c) => (
                <li key={c.atHours} className="mono-caption">
                  {t('ai.sprint.checkpoint', { h: c.atHours })} → {t(c.proofFrame as TKey)}
                </li>
              ))}
            </ul>
          </div>
          <p className="mono-caption">{t('ai.sprint.honest')}</p>
        </>
      )}

      <div
        className="mono-stack"
        style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--mono-border)' }}
      >
        <label className="mono-row mono-meta" style={{ gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={createProject}
            onChange={(e) => onCreateProject(e.target.checked)}
            style={{ accentColor: 'var(--mono-accent)' }}
          />
          {t('ai.approve.create')}
        </label>
        {path && (
          <label className="mono-row mono-meta" style={{ gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draftIntoWeek}
              onChange={(e) => onDraftIntoWeek(e.target.checked)}
              style={{ accentColor: 'var(--mono-accent)' }}
            />
            {t('ai.approve.week')}
          </label>
        )}
        <label className="mono-row mono-meta" style={{ gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={onConsent}
            style={{ accentColor: 'var(--mono-accent)' }}
          />
          {t('ai.approve.auto')}
        </label>
        <p className="mono-caption">{t('ai.approve.note')}</p>
      </div>

      <div className="mono-between" style={{ gap: 8 }}>
        <button onClick={onBack} className="mono-btn mono-btn-ghost mono-btn-sm">
          {t('morning.back')}
        </button>
        <button onClick={onApprove} className="mono-btn mono-btn-primary mono-btn-sm">
          {t('ai.approve.go')}
        </button>
      </div>
    </div>
  );
}
