import { useState } from 'react';
import type { TaskStatus, TaskPriority, TaskRecurrence } from '../../lib/tasks';
import {
  createSubtaskObject,
  canNest,
  subtasksOf,
  completeTask,
  updateTaskStatus,
  setBlockedBy,
  blockingTasks,
  canComplete,
  setRecurrence,
  setDueAt,
  setNotes,
  setTaskPoints,
  setTaskEstimate,
  setTaskMilestone,
  addTaskLink,
  removeTaskLink,
  removeTask,
  setTaskPriority,
  taskComplexity,
  impactEffort,
} from '../../lib/tasks';
import { PRIORITY_LABELS, STATUS_LABELS, TASK_RECURRENCES, TASK_POINTS } from '../../lib/tasks';
import { TrashIcon } from './icons';
import type { TaskRowProps } from './types';
import { openExternal, safeExternalUrl } from '../../lib/links';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDue(dueAt: number): string {
  return new Date(dueAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: 'Once',
  daily: 'Daily',
  weekly: 'Weekly',
};

/** Recursive task row: nesting, blockers, recurrence, due dates, notes. */
export default function TaskRow({
  task,
  tasks,
  projectId,
  depth,
  wbs,
  ancestorIds,
  onTasksChange,
}: TaskRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const [blockerPick, setBlockerPick] = useState('');
  const [linkDraft, setLinkDraft] = useState('');

  const done = task.status === 'completed';
  const gate = canComplete(task, tasks);
  const blockers = blockingTasks(task, tasks);
  const children = subtasksOf(tasks, task.id).filter((c) => !ancestorIds.includes(c.id));
  const ie = impactEffort(task, tasks);
  const nestable = canNest(tasks, task.id, projectId);
  const candidates = tasks.filter(
    (t) => t.projectId === projectId && t.id !== task.id && !(task.blockedBy ?? []).includes(t.id),
  );
  const overdue = task.dueAt !== undefined && !done && task.dueAt < startOfToday();
  const hasHiddenBadges =
    task.milestone === true ||
    (!done && blockers.length > 0) ||
    (task.recurrence !== undefined && task.recurrence !== 'none') ||
    typeof task.points === 'number' ||
    typeof task.estimateMin === 'number';

  const toggle = () => {
    if (done) {
      onTasksChange(updateTaskStatus(tasks, task.id, 'pending'));
      return;
    }
    const { tasks: next } = completeTask(tasks, task.id);
    onTasksChange(next);
  };

  const addSubtask = () => {
    const child = createSubtaskObject(tasks, task.id, subDraft);
    if (!child) return;
    onTasksChange([...tasks, child]);
    setSubDraft('');
  };

  const addBlocker = () => {
    if (!blockerPick) return;
    onTasksChange(setBlockedBy(tasks, task.id, [...(task.blockedBy ?? []), blockerPick]));
    setBlockerPick('');
  };

  return (
    <div style={depth > 0 ? { marginLeft: depth * 16 } : undefined}>
      <div
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
          done ? 'opacity-55' : ''
        } ${depth > 0 ? 'border-l-2 border-line/60' : ''}`}
      >
        <button
          onClick={toggle}
          disabled={!done && !gate.ok}
          className={`press flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset disabled:cursor-not-allowed disabled:opacity-40 ${
            done
              ? 'bg-accent text-on-accent ring-accent'
              : 'bg-ink/60 text-transparent ring-line hover:text-sage'
          }`}
          aria-label={done ? 'Mark incomplete' : 'Mark complete'}
          title={!done && !gate.ok ? `Blocked by: ${gate.blockers.join(', ')}` : undefined}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`min-w-0 flex-1 truncate text-left text-[13px] text-cream/90 hover:text-cream ${
            done ? 'line-through' : ''
          }`}
          title={task.notes ?? task.title}
        >
          {task.title}
        </button>
        {task.dueAt !== undefined && (
          <span
            className={`shrink-0 font-mono text-[10px] ${overdue ? 'font-bold text-tomato' : 'text-faint'}`}
            title={new Date(task.dueAt).toLocaleDateString()}
          >
            {formatDue(task.dueAt)}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <select
            value={task.priority}
            onChange={(e) =>
              onTasksChange(setTaskPriority(tasks, task.id, e.target.value as TaskPriority))
            }
            className="rounded bg-ink/50 px-1.5 py-1 font-mono text-[10px] text-faint ring-1 ring-inset ring-line"
            title="Priority"
          >
            {(['p0', 'p1', 'p2', 'p3'] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`press rounded p-1 font-mono text-[11px] hover:text-cream ${
              hasHiddenBadges && !showDetails ? 'text-sage' : 'text-faint'
            }`}
            aria-label={`${showDetails ? 'Hide' : 'Show'} details for ${task.title}`}
            title={
              hasHiddenBadges && !showDetails
                ? 'More info: milestone, blockers, recurrence, points or estimate set'
                : 'Details: notes, due date, recurrence, blockers, subtasks'
            }
          >
            ⋯
          </button>
          <button
            onClick={() => onTasksChange(removeTask(tasks, task.id))}
            className="press rounded p-1 text-faint hover:text-tomato"
            aria-label={`Delete task ${task.title}`}
            title={children.length > 0 ? `Deletes ${children.length} subtask(s) too` : undefined}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {showDetails && (
        <div
          className="mb-1 space-y-2 rounded-lg bg-ink/30 px-2.5 py-2.5"
          style={depth > 0 ? { marginLeft: 0 } : undefined}
        >
          {/* badges moved out of the collapsed row (Faza 12 density pass) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-faint">{wbs}</span>
            {task.milestone === true && (
              <span
                className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent ring-1 ring-inset ring-accent/40"
                title="Milestone"
              >
                ◆ Milestone
              </span>
            )}
            {!done && blockers.length > 0 && (
              <span
                className="shrink-0 rounded bg-tomato/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-tomato"
                title={`Blocked by: ${gate.blockers.join(', ')}`}
              >
                ⛔ {blockers.length}
              </span>
            )}
            {task.recurrence && task.recurrence !== 'none' && (
              <span
                className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-sage ring-1 ring-inset ring-line"
                title={`Repeats ${task.recurrence}`}
              >
                ↻ {task.recurrence === 'daily' ? 'D' : 'W'}
              </span>
            )}
            {typeof task.points === 'number' && (
              <span
                className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] text-sage ring-1 ring-inset ring-line"
                title="Story points"
              >
                {task.points}pt
              </span>
            )}
            {typeof task.estimateMin === 'number' && (
              <span
                className="shrink-0 rounded bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] text-sage ring-1 ring-inset ring-line"
                title="Estimated minutes"
              >
                ~{task.estimateMin}m
              </span>
            )}
            <span
              className="shrink-0 font-mono text-[9px] text-faint"
              title={`Auto complexity ${taskComplexity(task, tasks)}/5 (subtasks, blockers, detail)`}
            >
              ~{taskComplexity(task, tasks)}
            </span>
          </div>

          {/* status + due + recurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={task.status}
              onChange={(e) =>
                onTasksChange(updateTaskStatus(tasks, task.id, e.target.value as TaskStatus))
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Workflow status"
            >
              {(['pending', 'in_progress', 'blocked'] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
              <option value="completed">{STATUS_LABELS.completed}</option>
            </select>
            <input
              type="date"
              value={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''}
              onChange={(e) =>
                onTasksChange(
                  setDueAt(
                    tasks,
                    task.id,
                    e.target.value ? new Date(e.target.value + 'T12:00:00').getTime() : null,
                  ),
                )
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Due date"
            />
            <select
              value={task.recurrence ?? 'none'}
              onChange={(e) =>
                onTasksChange(setRecurrence(tasks, task.id, e.target.value as TaskRecurrence))
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Recurrence"
            >
              {TASK_RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
            <select
              value={typeof task.points === 'number' ? task.points : ''}
              onChange={(e) =>
                onTasksChange(
                  setTaskPoints(
                    tasks,
                    task.id,
                    e.target.value === '' ? null : Number(e.target.value),
                  ),
                )
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Story points"
            >
              <option value="">— pt</option>
              {TASK_POINTS.map((p) => (
                <option key={p} value={p}>
                  {p} pt
                </option>
              ))}
            </select>
            <select
              value={typeof task.estimateMin === 'number' ? task.estimateMin : ''}
              onChange={(e) =>
                onTasksChange(
                  setTaskEstimate(
                    tasks,
                    task.id,
                    e.target.value === '' ? null : Number(e.target.value),
                  ),
                )
              }
              className="h-8 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
              title="Time estimate (used by the morning ritual)"
            >
              <option value="">— est</option>
              {[15, 25, 50, 90, 120].map((m) => (
                <option key={m} value={m}>
                  ~{m}m
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                onTasksChange(setTaskMilestone(tasks, task.id, task.milestone !== true))
              }
              className={`press h-8 shrink-0 rounded-lg px-2 text-[12px] ring-1 ring-inset ${
                task.milestone === true
                  ? 'text-accent ring-accent/60'
                  : 'text-faint ring-line hover:text-cream'
              }`}
              title={task.milestone === true ? 'Remove milestone' : 'Mark as milestone'}
              aria-pressed={task.milestone === true}
            >
              ◆
            </button>
          </div>

          {/* notes */}
          <textarea
            key={`notes-${task.id}-${task.updatedAt}`}
            defaultValue={task.notes ?? ''}
            maxLength={2000}
            rows={2}
            onBlur={(e) => {
              if ((e.target.value.trim() || '') !== (task.notes ?? '')) {
                onTasksChange(setNotes(tasks, task.id, e.target.value));
              }
            }}
            placeholder="Notes… (saved on blur)"
            className="w-full resize-y rounded-lg bg-ink/50 px-2.5 py-2 text-[12px] leading-relaxed text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
          />

          {/* links — inert text unless an http(s) URL, then a hardened open */}
          {(task.links ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(task.links ?? []).map((l) => {
                const safe = safeExternalUrl(l);
                return (
                  <span
                    key={l}
                    className="flex max-w-full items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-[10px] text-sage ring-1 ring-inset ring-line"
                    title={l}
                  >
                    <span className="truncate">🔗 {l}</span>
                    {safe && (
                      <button
                        onClick={() => openExternal(safe)}
                        className="press shrink-0 text-faint hover:text-cream"
                        aria-label={`Open link ${l} in a new tab`}
                        title={safe}
                      >
                        ↗
                      </button>
                    )}
                    <button
                      onClick={() => onTasksChange(removeTaskLink(tasks, task.id, l))}
                      className="press shrink-0 text-faint hover:text-tomato"
                      aria-label={`Remove link ${l}`}
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={linkDraft}
              maxLength={300}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkDraft.trim()) {
                  onTasksChange(addTaskLink(tasks, task.id, linkDraft));
                  setLinkDraft('');
                }
              }}
              placeholder="Attach link… (Enter)"
              className="h-8 min-w-0 flex-1 rounded-lg bg-ink/50 px-2.5 font-mono text-[11px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
            />
          </div>

          {ie.suggested !== task.priority && !done && (
            <button
              onClick={() => onTasksChange(setTaskPriority(tasks, task.id, ie.suggested))}
              className="press w-fit rounded-lg bg-ink/50 px-2.5 py-1.5 font-mono text-[11px] text-sage ring-1 ring-inset ring-line hover:text-cream"
              title={`Impact ${ie.impact}/5 × effort ${ie.effort}/5 suggests ${ie.suggested.toUpperCase()} (now ${task.priority.toUpperCase()})`}
            >
              ✨ Suggests {ie.suggested.toUpperCase()} — apply?
            </button>
          )}

          {/* blockers */}
          <div>
            {blockers.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {blockers.map((b) => (
                  <span
                    key={b.id}
                    className="flex items-center gap-1 rounded-full bg-tomato/15 px-2 py-0.5 font-mono text-[10px] text-tomato"
                  >
                    ⛔ {b.title}
                    <button
                      onClick={() =>
                        onTasksChange(
                          setBlockedBy(
                            tasks,
                            task.id,
                            (task.blockedBy ?? []).filter((id) => id !== b.id),
                          ),
                        )
                      }
                      className="press hover:text-cream"
                      aria-label={`Remove blocker ${b.title}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
            {candidates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={blockerPick}
                  onChange={(e) => setBlockerPick(e.target.value)}
                  className="h-8 min-w-0 flex-1 rounded-lg bg-ink/50 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
                  title="Must complete first"
                >
                  <option value="">Blocked by…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addBlocker}
                  disabled={!blockerPick}
                  className="press h-8 shrink-0 rounded-lg px-2.5 text-[12px] text-sage ring-1 ring-inset ring-line hover:text-cream disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* subtask */}
          {nestable ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={subDraft}
                maxLength={120}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="Add a subtask…"
                className="h-8 min-w-0 flex-1 rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
              />
              <button
                onClick={addSubtask}
                disabled={!subDraft.trim()}
                className="press btn-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-base font-bold disabled:opacity-40"
                aria-label="Add subtask"
              >
                +
              </button>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-faint">
              Max nesting depth ({children.length} subtask{children.length === 1 ? '' : 's'}).
            </p>
          )}
        </div>
      )}

      {/* children */}
      {children.map((child, ci) => (
        <TaskRow
          key={child.id}
          task={child}
          tasks={tasks}
          projectId={projectId}
          depth={depth + 1}
          wbs={`${wbs}.${ci + 1}`}
          ancestorIds={[...ancestorIds, task.id]}
          onTasksChange={onTasksChange}
        />
      ))}
    </div>
  );
}
