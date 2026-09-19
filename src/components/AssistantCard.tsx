import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../lib/projects';
import { activeProjects } from '../lib/projects';
import type { Task, TaskPriority } from '../lib/tasks';
import { createTaskObject, setDueAt } from '../lib/tasks';
import type { Session } from '../lib/store';
import type { Goal } from '../lib/goals';
import { addTaskToDay, IVY_MAX_TASKS, IVY_FREE_MAX_TASKS, type IvyPlan } from '../lib/ivyLee';
import { dayKeyInTz } from '../lib/timezone';
import {
  QUICK_ACTIONS,
  ASSISTANT_TONES,
  TONE_LABELS,
  appendMessage,
  loadAssistantTone,
  saveAssistantTone,
  motivationLine,
  respondTo,
  saveChatHistory,
  type AssistantTone,
  type ChatMessage,
} from '../lib/assistant';

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
  onTasksChange: (tasks: Task[]) => void;
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
  onTasksChange,
  isPro = false,
}: Props) {
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<AssistantTone>(loadAssistantTone);
  const [speakOn, setSpeakOn] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLUListElement | null>(null);

  const greeting = useMemo(
    () => motivationLine(history, timezone, isPro ? tone : 'concise'),
    [history, timezone, tone, isPro],
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
      rec.lang = 'en-US';
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

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || (!isPro && !isQuickAllowed(text))) return;
    let log = appendMessage(messages, 'user', text);
    const reply = respondTo(text, { tasks, projects, history, timezone, goals, energyLog }, tone);
    let spoken = reply.text;
    if (reply.action?.type === 'add-task') {
      const target = resolveProject(reply.action.projectQuery);
      if (!target) {
        spoken = 'Create a project first — every task needs a home. Then try again.';
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
        spoken = 'Your Ivy Lee list is already full — clear something first.';
        log = appendMessage(log, 'assistant', spoken);
      }
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

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="AI assistant">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Assistant</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            {isPro ? 'Ask anything · it creates tasks too' : '2 free quick actions · chat is Pro'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => commit([])}
            className="press font-mono text-[11px] text-faint hover:text-cream"
            title="Clear conversation"
          >
            Clear
          </button>
        )}
      </header>

      <div className="mt-3 flex items-center gap-2">
        {isPro && (
          <select
            value={tone}
            onChange={(e) => {
              const next = e.target.value as AssistantTone;
              setTone(next);
              saveAssistantTone(next);
            }}
            className="h-7 rounded-lg bg-ink/40 px-2 font-mono text-[11px] text-sage ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            title="Assistant personality"
            aria-label="Assistant personality"
          >
            {ASSISTANT_TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABELS[t]}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => setSpeakOn(!speakOn)}
          className={`press rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-inset ${
            speakOn ? 'text-accent ring-accent/50' : 'text-faint ring-line hover:text-cream'
          }`}
          aria-pressed={speakOn}
          title="Read replies aloud"
        >
          {speakOn ? '🔊' : '🔇'}
        </button>
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint" title={greeting}>
          {greeting}
        </p>
      </div>

      {messages.length > 0 && (
        <ul ref={scrollRef} className="nice-scroll mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-accent/15 text-cream ring-1 ring-inset ring-accent/30'
                  : 'bg-ink/40 text-sage ring-1 ring-inset ring-line'
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.filter((q) => q.message !== 'Add task ').map((q) => {
          const locked = q.pro && !isPro;
          return (
            <button
              key={q.label}
              onClick={() => !locked && send(q.message)}
              disabled={locked}
              className={`press rounded-full px-3 py-1.5 font-mono text-[11px] ring-1 ring-inset ${
                locked
                  ? 'cursor-not-allowed text-faint ring-line/50'
                  : 'text-sage ring-line hover:text-cream hover:ring-accent/50'
              }`}
              title={locked ? 'Pro quick action — upgrade to unlock' : q.label}
            >
              {locked ? `🔒 ${q.label}` : q.label}
            </button>
          );
        })}
      </div>

      {isPro ? (
        <div className="mt-2.5 flex items-center gap-2">
          {micSupported && (
            <button
              onClick={listen}
              disabled={listening}
              className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                listening ? 'text-accent ring-accent/60' : 'text-sage ring-line hover:text-cream'
              } disabled:opacity-60`}
              title="Voice input"
              aria-label="Voice input"
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
            placeholder='Ask or "add task Draft proposal p1 tomorrow"…'
            className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim()}
            className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
          <p className="text-[12px] leading-relaxed text-cream">
            Pro unlocks free-text chat, task creation and goal reviews.
          </p>
        </div>
      )}
    </section>
  );
}
