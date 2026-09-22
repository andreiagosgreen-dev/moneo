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
import type { BuiltPath, ClarifyId, PathInput, SkillLevel } from '../lib/ai/types';
import { createProjectObject, type Project, type ProjectCategory } from '../lib/projects';
import { createTaskObject, setTaskEstimate, type Task } from '../lib/tasks';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { weekdayOfKey, type TimeBlock, type Weekday } from '../lib/timeBlocks';
import { dayCapacity, nextDayKey } from '../lib/ritual';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  projects: Project[];
  projectsChange: (projects: Project[]) => void;
  tasks: Task[];
  tasksChange: (tasks: Task[]) => void;
  ivyPlans: IvyPlan[];
  plansChange: (plans: IvyPlan[]) => void;
  blocks: TimeBlock[];
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
  ivyPlans,
  plansChange,
  blocks,
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
    const taskText = (frame: string, milestoneId: string): string =>
      t(frame as TKey, { goal: path?.goal ?? '', outcome: outcomeText(taskPhase(milestoneId)) });

    const planned =
      path?.tasks.map((x) => ({
        title: taskText(x.title, x.milestoneId),
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
    }

    if (projectId) {
      for (const item of planned.slice(0, MAX_DRAFT_TASKS)) {
        const task = createTaskObject(projectId, item.title, item.priority);
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
          const res = addTaskToDay(acc, key, item.title, maxIvy, item.pomodoros * POMODORO_MIN);
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
    <section className="card px-6 py-6 sm:px-7" aria-label={t('ai.title')}>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        {t('ai.kicker')}
      </p>
      <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-cream">
        {t('ai.title')}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-sage">{t('ai.subtitle')}</p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('ai.modeAria')}>
        {(['goal', 'sprint'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              reset();
            }}
            aria-pressed={mode === m}
            className={`press rounded-lg px-3.5 py-2 text-[12px] font-semibold ring-1 ring-inset ${
              mode === m
                ? 'btn-accent ring-transparent'
                : 'bg-ink/30 text-cream ring-line hover:ring-accent/50'
            }`}
          >
            {t(m === 'goal' ? 'ai.modeGoal' : 'ai.modeSprint')}
          </button>
        ))}
      </div>

      {step === 'input' && (
        <div className="mt-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t(mode === 'goal' ? 'ai.goalPh' : 'ai.skillPh')}
            aria-label={t(mode === 'goal' ? 'ai.goalAria' : 'ai.skillAria')}
            className="w-full resize-y rounded-xl border border-line bg-ink/60 px-3 py-2.5 text-sm text-cream placeholder:text-faint focus:[border-color:var(--accent)] focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={startBuild}
              disabled={!text.trim()}
              className="press btn-accent rounded-lg px-5 py-2 font-display text-[13px] font-bold disabled:opacity-40"
            >
              {t(mode === 'goal' ? 'ai.build' : 'ai.buildSprint')}
            </button>
          </div>
        </div>
      )}

      {step === 'questions' && (
        <div className="mt-4 space-y-3">
          <p className="text-[13px] font-semibold text-cream">{t('ai.questionsTitle')}</p>
          {questions.includes('horizon') && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
                {t('ai.q.horizon')}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    aria-pressed={horizon === h}
                    className={`press rounded-lg px-3 py-1.5 font-mono text-[12px] ring-1 ring-inset ${
                      horizon === h
                        ? 'text-accent ring-accent/60'
                        : 'text-faint ring-line hover:text-cream'
                    }`}
                  >
                    {h >= 480 ? t('ai.q.life') : h >= 12 ? tp('ai.q.years', Math.round(h / 12)) : tp('ai.q.months', h)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {questions.includes('level') && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
                {t('ai.q.level')}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    aria-pressed={level === l}
                    className={`press rounded-lg px-3 py-1.5 font-mono text-[12px] ring-1 ring-inset ${
                      level === l
                        ? 'text-accent ring-accent/60'
                        : 'text-faint ring-line hover:text-cream'
                    }`}
                  >
                    {t(`ai.q.level.${l}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {questions.includes('hours') && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-faint">
                {t('ai.q.hours')}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[2, 5, 8, 12].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    aria-pressed={hours === h}
                    className={`press rounded-lg px-3 py-1.5 font-mono text-[12px] ring-1 ring-inset ${
                      hours === h
                        ? 'text-accent ring-accent/60'
                        : 'text-faint ring-line hover:text-cream'
                    }`}
                  >
                    {t('ai.q.hoursPerWeek', { n: h })}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setStep('input')}
              className="press rounded-lg px-4 py-2 font-mono text-[12px] text-faint hover:text-cream"
            >
              {t('morning.back')}
            </button>
            <button
              onClick={answerAndBuild}
              className="press btn-accent rounded-lg px-5 py-2 font-display text-[13px] font-bold"
            >
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
        <div className="mt-4 rounded-xl bg-ink/40 px-4 py-3.5 ring-1 ring-inset ring-line">
          <p className="text-[14px] font-semibold text-cream">{t('ai.done.title')}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-sage">{resultNote}</p>
          <p className="mt-1 font-mono text-[11px] text-faint">{t('ai.done.hint')}</p>
          <div className="mt-2.5 flex justify-end">
            <button
              onClick={reset}
              className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px]"
            >
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
    <div className="mt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
        {t('ai.draftKicker')}
      </p>

      {path && (
        <>
          <div className="mt-2 space-y-2">
            {path.phases.map((phase) => (
              <div
                key={phase.id}
                className="rounded-xl bg-ink/40 px-4 py-3 ring-1 ring-inset ring-line"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold text-cream">
                    {t(phase.outcome as TKey, { goal: path.goal })}
                  </p>
                  <p className="shrink-0 font-mono text-[10px] text-faint">
                    {t('ai.phase.months', { a: phase.months[0], b: phase.months[1] })}
                  </p>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {path.milestones
                    .filter((m) => m.phaseId === phase.id)
                    .map((m) => (
                      <li key={m.id} className="text-[12px] text-sage">
                        ◆ {t(m.title as TKey, { outcome: outcomeText(m.phaseId) })}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer font-mono text-[11px] text-sage hover:text-cream">
              {tp('ai.draft.tasks', path.tasks.length, { n: path.totalPomodoros })}
            </summary>
            <ul className="mt-1.5 max-h-44 space-y-1 overflow-y-auto">
              {path.tasks.map((x) => (
                <li
                  key={x.draftId}
                  className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-1.5 text-[12px] text-cream/90 ring-1 ring-inset ring-line"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {t(x.title as TKey, {
                      goal: path.goal,
                      outcome: outcomeText(phaseOfTask(x.milestoneId)),
                    })}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-faint">
                    ~{x.pomodoros}🍅
                  </span>
                </li>
              ))}
            </ul>
          </details>
          {path.assumptions.map((a) => (
            <p key={a} className="mt-1.5 font-mono text-[11px] text-faint">
              {t(a === 'trimmed-to-20' ? 'ai.assume.trimmed' : 'ai.assume.capacity')}
            </p>
          ))}
        </>
      )}

      {sprint && (
        <>
          <div className="mt-2 rounded-xl bg-ink/40 px-4 py-3 ring-1 ring-inset ring-line">
            <p className="text-[14px] font-semibold text-cream">
              {t(sprint.outcomeFrame as TKey, sprint.outcomeVars)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              {t('ai.sprint.meta', { weeks: sprint.weeks, pomodoros: sprint.totalPomodoros })}
            </p>
            <ul className="mt-2 space-y-1">
              {sprint.subskillFrames.map((f) => (
                <li key={f} className="text-[12px] text-sage">
                  ◆ {t(f as TKey, { skill: sprint.skill })}
                </li>
              ))}
            </ul>
            <ul className="mt-2 space-y-1 border-t border-line/60 pt-2">
              {sprint.checkpoints.map((c) => (
                <li key={c.atHours} className="font-mono text-[11px] text-faint">
                  {t('ai.sprint.checkpoint', { h: c.atHours })} → {t(c.proofFrame as TKey)}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-faint">{t('ai.sprint.honest')}</p>
        </>
      )}

      <div className="mt-3 space-y-1.5 border-t border-line/60 pt-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-cream/90">
          <input
            type="checkbox"
            checked={createProject}
            onChange={(e) => onCreateProject(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          {t('ai.approve.create')}
        </label>
        {path && (
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-cream/90">
            <input
              type="checkbox"
              checked={draftIntoWeek}
              onChange={(e) => onDraftIntoWeek(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            {t('ai.approve.week')}
          </label>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-cream/90">
          <input
            type="checkbox"
            checked={consent}
            onChange={onConsent}
            className="accent-[var(--accent)]"
          />
          {t('ai.approve.auto')}
        </label>
        <p className="font-mono text-[10px] leading-relaxed text-faint">{t('ai.approve.note')}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="press rounded-lg px-3 py-2 font-mono text-[12px] text-faint hover:text-cream"
        >
          {t('morning.back')}
        </button>
        <button
          onClick={onApprove}
          className="press btn-accent rounded-lg px-5 py-2 font-display text-[13px] font-bold"
        >
          {t('ai.approve.go')}
        </button>
      </div>
    </div>
  );
}
