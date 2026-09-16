import { useEffect, useRef, useState } from 'react';
import type { Project } from '../lib/projects';
import { activeProjects } from '../lib/projects';
import type { Task, TaskPriority } from '../lib/tasks';
import { createTaskObject, setDueAt } from '../lib/tasks';
import type { Session } from '../lib/store';
import type { Goal } from '../lib/goals';
import {
  QUICK_ACTIONS,
  appendMessage,
  respondTo,
  saveChatHistory,
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
  selectedProjectId: string | null;
  onTasksChange: (tasks: Task[]) => void;
  isPro?: boolean;
}

export default function AssistantCard({
  messages,
  messagesChange,
  tasks,
  projects,
  history,
  timezone,
  goals,
  selectedProjectId,
  onTasksChange,
  isPro = false,
}: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLUListElement | null>(null);

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

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || (!isPro && !isQuickAllowed(text))) return;
    let log = appendMessage(messages, 'user', text);
    const reply = respondTo(text, { tasks, projects, history, timezone, goals });
    if (reply.action?.type === 'add-task') {
      const target = resolveProject(reply.action.projectQuery);
      if (!target) {
        log = appendMessage(
          log,
          'assistant',
          'Create a project first — every task needs a home. Then try again.',
        );
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
    } else {
      log = appendMessage(log, 'assistant', reply.text);
    }
    commit(log);
    setDraft('');
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
            Rule-based coach · {isPro ? 'full access' : '2 quick actions'}
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
