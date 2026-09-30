import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../lib/projects';
import { activeProjects, FREE_PROJECTS_LIMIT } from '../lib/projects';
import type { Task, TaskPriority } from '../lib/tasks';
import {
  completeTask,
  createTaskObject,
  removeTask,
  setDueAt,
  setTaskEstimate,
  setTaskPriority,
  updateTaskStatus,
} from '../lib/tasks';
import type { Session } from '../lib/store';
import type { Goal } from '../lib/goals';
import type { Sprint } from '../lib/sprints';
import type { WaterfallPhase } from '../lib/waterfall';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import { isLibreAiConfigured, libreAssist } from '../lib/ai/ollama';
import {
  QUICK_ACTIONS,
  QUICK_LABEL_KEYS,
  ASSISTANT_TONES,
  TONE_KEYS,
  appendMessage,
  loadAssistantTone,
  saveAssistantTone,
  motivationLine,
  respondTo,
  saveChatHistory,
  type AssistantTone,
  type ChatMessage,
} from '../lib/assistant';
import RoadmapPanel from './RoadmapPanel';
import {
  FREE_ROADMAPS_LIMIT,
  activeRoadmap,
  addStep,
  canAddRoadmap,
  saveActiveRoadmapId,
  saveRoadmaps,
  upsertRoadmap,
  type Roadmap,
} from '../lib/ai/roadmap';
import { approveRoadmapCompose } from '../lib/ai/approvePath';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

interface Props {
  messages: ChatMessage[];
  messagesChange: (messages: ChatMessage[]) => void;
  tasks: Task[];
  projects: Project[];
  history: Session[];
  timezone: string;
  goals: Goal[];
  energyLog: Array<{ at: number; level: number }>;
  ivyPlans: IvyPlan[];
  onIvyPlansChange: (plans: IvyPlan[]) => void;
  selectedProjectId: string | null;
  sprints: Sprint[];
  onTasksChange: (tasks: Task[]) => void;
  onProjectsChange?: (projects: Project[]) => void;
  phases?: WaterfallPhase[];
  onPhasesChange?: (phases: WaterfallPhase[]) => void;
  roadmaps: Roadmap[];
  onRoadmapsChange: (list: Roadmap[]) => void;
  onWorkFocus?: (projectId: string, taskId: string | null) => void;
  isPro?: boolean;
}

interface WebSpeechRecognizer {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

export default function AssistantCard({
  messages,
  messagesChange,
  tasks,
  projects,
  history,
  timezone,
  goals,
  energyLog,
  ivyPlans,
  onIvyPlansChange,
  selectedProjectId,
  sprints,
  onTasksChange,
  onProjectsChange,
  phases = [],
  onPhasesChange,
  roadmaps,
  onRoadmapsChange,
  onWorkFocus,
  isPro = false,
}: Props) {
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<AssistantTone>(loadAssistantTone);
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>(undefined);
  const [speakOn, setSpeakOn] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const i18n = useI18n();
  const { t, tag } = i18n;

  const currentRoadmap = useMemo(() => activeRoadmap(roadmaps), [roadmaps]);

  const greeting = useMemo(
    () => motivationLine(history, timezone, isPro ? tone : 'concise', i18n),
    [history, timezone, tone, isPro, i18n],
  );

  const micSupported =
    typeof window !== 'undefined' &&
    ((window as unknown as Record<string, unknown>).SpeechRecognition !== undefined ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition !== undefined);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const resolveProject = (query: string | null): Project | null => {
    const live = activeProjects(projects);
    if (live.length === 0) return null;
    if (query) {
      const hit = live.find((p) => p.name.toLowerCase().includes(query.toLowerCase()));
      if (hit) return hit;
    }
    if (selectedProjectId) {
      const selected = live.find((p) => p.id === selectedProjectId);
      if (selected) return selected;
    }
    return live[0];
  };

  const commit = (log: ChatMessage[]) => {
    saveChatHistory(log);
    messagesChange(log);
  };

  const speak = (text: string) => {
    try {
      if (!speakOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.slice(0, 300)));
    } catch {
      /* speech unavailable */
    }
  };

  const listen = () => {
    try {
      const w = window as unknown as {
        SpeechRecognition?: new () => WebSpeechRecognizer;
        webkitSpeechRecognition?: new () => WebSpeechRecognizer;
      };
      const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Ctor) return;
      const rec = new Ctor();
      rec.lang = tag;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
        const transcript = e.results[0]?.[0]?.transcript ?? '';
        setListening(false);
        if (transcript.trim()) send(transcript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || (!isPro && !isQuickAllowed(text))) return;
    let log = appendMessage(messages, 'user', text);
    const todayKey = dayKeyInTz(Date.now(), timezone);
    const plannedIds = new Set(
      (ivyPlans.find((p) => p.dateKey === todayKey)?.tasks ?? [])
        .map((x) => x.taskId)
        .filter((id): id is string => !!id),
    );
    const reply = respondTo(
      text,
      {
        tasks,
        projects,
        history,
        timezone,
        goals,
        energyLog,
        sprints,
        selectedProjectId,
        plannedIds,
      },
      tone,
      i18n,
      focusTaskId,
    );
    if (reply.contextTaskId !== undefined) setFocusTaskId(reply.contextTaskId);
    let spoken = reply.text;
    // Libre model (optional): enhance text answers only; actions stay rule-based.
    if (!reply.action && isLibreAiConfigured()) {
      const ctx = [
        `Horizon goals: ${
          goals
            .slice(0, 5)
            .map((g) => g.title)
            .join('; ') || 'none'
        }`,
        `Focus sessions today stats available.`,
      ].join('\n');
      const libre = await libreAssist(text, ctx);
      if (libre.ok) spoken = libre.text;
    }
    if (reply.action?.type === 'add-task') {
      const target = resolveProject(reply.action.projectQuery);
      if (!target) {
        spoken = t('assist.noProject');
        log = appendMessage(log, 'assistant', spoken);
      } else {
        const task = createTaskObject(
          target.id,
          reply.action.title,
          reply.action.priority as TaskPriority,
        );
        let next = [...tasks, task];
        if (reply.action.dueAt !== null) next = setDueAt(next, task.id, reply.action.dueAt);
        onTasksChange(next);
        log = appendMessage(log, 'assistant', reply.text);
      }
    } else if (reply.action?.type === 'build-plan') {
      const key = dayKeyInTz(Date.now(), timezone);
      const max = isPro ? IVY_MAX_TASKS : IVY_FREE_MAX_TASKS;
      let plans = ivyPlans;
      let added = 0;
      for (const item of reply.action.items.slice(0, max)) {
        const res = addTaskToDay(plans, key, item, max);
        plans = res.plans;
        if (res.added) added += 1;
      }
      if (added > 0) {
        onIvyPlansChange(plans);
        log = appendMessage(log, 'assistant', reply.text);
      } else {
        spoken = t('assist.full');
        log = appendMessage(log, 'assistant', spoken);
      }
    } else if (reply.action?.type === 'complete-task') {
      const { tasks: next } = completeTask(tasks, reply.action.taskId);
      onTasksChange(next);
      log = appendMessage(log, 'assistant', reply.text);
    } else if (reply.action?.type === 'delete-task') {
      onTasksChange(removeTask(tasks, reply.action.taskId));
      log = appendMessage(log, 'assistant', reply.text);
    } else if (reply.action?.type === 'reschedule-task') {
      onTasksChange(setDueAt(tasks, reply.action.taskId, reply.action.dueAt));
      log = appendMessage(log, 'assistant', reply.text);
    } else if (reply.action?.type === 'reprioritize-task') {
      onTasksChange(setTaskPriority(tasks, reply.action.taskId, reply.action.priority));
      log = appendMessage(log, 'assistant', reply.text);
    } else {
      log = appendMessage(log, 'assistant', reply.text);
    }
    commit(log);
    setDraft('');
    speak(spoken);
  };

  const isQuickAllowed = (message: string) => {
    const chip = QUICK_ACTIONS.find((q) => q.message === message);
    if (!chip) return isPro;
    return isPro || !chip.pro;
  };

  const commitRoadmap = (r: Roadmap | null) => {
    if (!r) {
      onRoadmapsChange([]);
      saveRoadmaps([]);
      saveActiveRoadmapId(null);
      return;
    }
    const next = upsertRoadmap(roadmaps, r);
    onRoadmapsChange(next);
    saveRoadmaps(next);
    saveActiveRoadmapId(r.id);
  };

  /** Keep roadmap step checkboxes and linked Tasks in sync (A→Z). */
  const syncRoadmap = (r: Roadmap | null) => {
    if (r && currentRoadmap) {
      let nextTasks = tasks;
      let dirty = false;
      for (const step of r.steps) {
        if (!step.taskId) continue;
        const prev = currentRoadmap.steps.find((s) => s.id === step.id);
        if (!prev || prev.done === step.done) continue;
        dirty = true;
        if (step.done) {
          nextTasks = completeTask(nextTasks, step.taskId).tasks;
        } else {
          nextTasks = updateTaskStatus(nextTasks, step.taskId, 'pending');
        }
      }
      if (dirty) onTasksChange(nextTasks);
    }
    commitRoadmap(r);
  };

  const approveRoadmap = (r: Roadmap) => {
    if (!onProjectsChange) {
      commitRoadmap(r);
      return;
    }
    const others = roadmaps.filter((x) => x.id !== r.id);
    // Free: one plan slot — a new Start replaces the previous plan.
    const replacing = !isPro && others.length >= FREE_ROADMAPS_LIMIT;
    if (!replacing && !canAddRoadmap(isPro, others.length)) {
      const log = appendMessage(
        messages,
        'assistant',
        t('assist.roadmap.freeLimit', { n: FREE_ROADMAPS_LIMIT }),
      );
      commit(log);
      return;
    }
    // New plan creates a project — Free still capped at FREE_PROJECTS_LIMIT.
    const needsNewProject = !r.projectId;
    if (needsNewProject && !isPro && projects.length >= FREE_PROJECTS_LIMIT) {
      const log = appendMessage(messages, 'assistant', t('proj.limit', { n: FREE_PROJECTS_LIMIT }));
      commit(log);
      return;
    }
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const mins = history
      .filter((s) => s.at >= weekAgo)
      .reduce((sum, s) => sum + Math.max(0, s.min), 0);
    const perDay = Math.round(mins / 7);
    const result = approveRoadmapCompose({
      roadmap: r,
      projects,
      tasks,
      phases,
      paceMinPerDay: perDay,
    });
    onProjectsChange(result.projects);
    onTasksChange(result.tasks);
    onPhasesChange?.(result.phases);
    if (replacing) {
      onRoadmapsChange([result.roadmap]);
      saveRoadmaps([result.roadmap]);
      saveActiveRoadmapId(result.roadmap.id);
    } else {
      commitRoadmap(result.roadmap);
    }
    const log = appendMessage(
      messages,
      'assistant',
      t('assist.roadmap.approved', { n: r.steps.length, title: r.title }),
    );
    commit(log);
    // Close the loop: land on Focus with the first open step selected.
    onWorkFocus?.(result.projectId, result.focusTaskId);
  };

  /** After approve, new steps must create Tasks so Focus bind stays intact. */
  const addLinkedStep = (title: string) => {
    if (!currentRoadmap) return;
    if (!currentRoadmap.projectId) {
      syncRoadmap(addStep(currentRoadmap, title));
      return;
    }
    const task = createTaskObject(currentRoadmap.projectId, title, 'p2');
    let nextTasks = [...tasks, task];
    nextTasks = setTaskEstimate(nextTasks, task.id, 25);
    onTasksChange(nextTasks);
    syncRoadmap(addStep(currentRoadmap, title, 25, Date.now(), task.id));
  };

  return (
    <section className="mono-card mono-panel" aria-label={t('assist.aria')}>
      <header className="mono-panel-head mono-between" style={{ gap: 12, alignItems: 'start' }}>
        <div>
          <h2 className="mono-h2">{t('assist.title')}</h2>
          <p className="mono-meta">{t(isPro ? 'assist.subPro' : 'assist.subFree')}</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => commit([])}
            className="mono-btn mono-btn-ghost mono-btn-sm"
            title={t('assist.clearTitle')}
          >
            {t('assist.clear')}
          </button>
        )}
      </header>

      <RoadmapPanel
        roadmap={currentRoadmap}
        onRoadmapChange={syncRoadmap}
        onApprove={approveRoadmap}
        onWorkFocus={onWorkFocus}
        onAddStep={addLinkedStep}
        isPro={isPro}
      />

      <div className="mono-greet">
        {isPro && (
          <select
            value={tone}
            onChange={(e) => {
              const next = e.target.value as AssistantTone;
              setTone(next);
              saveAssistantTone(next);
            }}
            className="mono-field mono-field-sm mono-field-auto"
            title={t('assist.toneTitle')}
            aria-label={t('assist.toneAria')}
          >
            {ASSISTANT_TONES.map((tn) => (
              <option key={tn} value={tn}>
                {t(TONE_KEYS[tn] as TKey)}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setSpeakOn(!speakOn)}
          className="mono-chip mono-chip-sm"
          aria-pressed={speakOn}
          aria-label={t('assist.speakTitle')}
          title={t('assist.speakTitle')}
        >
          {speakOn ? '🔊' : '🔇'}
        </button>
        <p title={greeting}>{greeting}</p>
      </div>

      {messages.length > 0 && (
        <ul ref={scrollRef} className="nice-scroll mono-chat">
          {messages.map((m) => (
            <li
              key={m.id}
              className={m.role === 'user' ? 'mono-bubble mono-bubble-user' : 'mono-bubble'}
            >
              {m.text}
            </li>
          ))}
        </ul>
      )}

      <div className="mono-inline">
        {QUICK_ACTIONS.filter((q) => q.message !== 'Add task ').map((q) => {
          const locked = q.pro && !isPro;
          const label = t(QUICK_LABEL_KEYS[q.message] as TKey);
          return (
            <button
              key={q.label}
              onClick={() => !locked && send(q.message)}
              disabled={locked}
              className="mono-chip mono-chip-sm"
              title={locked ? t('assist.locked') : label}
            >
              {locked ? `🔒 ${label}` : label}
            </button>
          );
        })}
      </div>

      {isPro ? (
        <div className="mono-row" style={{ gap: 8 }}>
          {micSupported && (
            <button
              onClick={listen}
              disabled={listening}
              aria-pressed={listening}
              className="mono-chip mono-chip-sm"
              title={t('assist.voice')}
              aria-label={t('assist.voiceAria')}
            >
              🎙
            </button>
          )}
          <input
            type="text"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(draft)}
            placeholder={t('assist.ph')}
            aria-label={t('assist.ph')}
            className="mono-field mono-field-sm"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim()}
            className="mono-btn mono-btn-primary mono-btn-sm"
            aria-label={t('assist.send')}
          >
            ↑
          </button>
        </div>
      ) : (
        <p className="mono-note">{t('assist.proBox')}</p>
      )}
    </section>
  );
}
