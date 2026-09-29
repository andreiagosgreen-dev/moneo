import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import MonoCard from './MonoCard';
import { QuickPills } from './MonoQuickPreview';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Suggestion, TriageAction } from '../lib/triage';
import type { Task } from '../lib/tasks';

interface Props {
  suggestions: Suggestion[];
  tasks: Task[];
  onAction: (s: Suggestion, action: TriageAction) => { ok: boolean; reason?: 'full' };
  /** Restores the last dropped task. */
  onUndo?: () => void;
  /** Called once when every card is sorted or the step is skipped. */
  onFinish: () => void;
}

const ACTIONS: TriageAction[] = ['today', 'tomorrow', 'later', 'drop'];

/** Sorts suggestions one card at a time: Today / Tomorrow / Later / Drop. */
export default function MonoTriage({ suggestions, tasks, onAction, onUndo, onFinish }: Props) {
  const { t, fmtNum } = useI18n();
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const [dropped, setDropped] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const moved = useRef(false);
  const done = skipped || index >= suggestions.length;

  useEffect(() => {
    if (done && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [done, onFinish]);

  useEffect(() => {
    if (moved.current && !done) cardRef.current?.focus();
  }, [index, done]);

  const undo = () => {
    if (dropped === null) return;
    onUndo?.();
    moved.current = true;
    setIndex(dropped);
    setDropped(null);
  };

  const undoLine =
    dropped !== null ? (
      <p className="mono-meta mono-triage-undo" role="status">
        {t('mono.inbox.deleted')}{' '}
        <button type="button" className="mono-link-btn" onClick={undo}>
          {t('mono.inbox.undo')}
        </button>
      </p>
    ) : null;

  if (done) {
    return (
      <div className="mono-triage">
        {skipped ? null : undoLine}
        <p className="mono-h3 mono-triage-done" role="status">
          {t('mono.triage.done')}
        </p>
      </div>
    );
  }

  const s = suggestions[index];
  const task = s.taskId ? tasks.find((x) => x.id === s.taskId) : undefined;

  const act = (action: TriageAction) => {
    const res = onAction(s, action);
    if (!res.ok) {
      setFull(res.reason === 'full');
      return;
    }
    setFull(false);
    setDropped(action === 'drop' ? index : null);
    moved.current = true;
    setIndex(index + 1);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      act(ACTIONS[n - 1]);
    }
  };

  return (
    <div className="mono-triage">
      {undoLine}
      <MonoCard>
        <div
          ref={cardRef}
          tabIndex={-1}
          className="mono-triage-card"
          onKeyDown={onKey}
          aria-labelledby="mono-triage-title"
        >
          <div className="mono-between" style={{ gap: 8 }}>
            <span className="mono-eyebrow" style={{ marginBottom: 0 }}>
              {t(`mono.triage.reason.${s.reason}` as 'mono.triage.reason.inbox')}
            </span>
            <span className="mono-meta">
              {t('mono.triage.progress', {
                i: fmtNum(index + 1),
                n: fmtNum(suggestions.length),
              })}
            </span>
          </div>
          <h3 id="mono-triage-title" className="mono-h3" style={{ margin: '6px 0 4px' }}>
            {task?.title ?? s.title}
          </h3>
          {task ? (
            <QuickPills
              q={{
                dueAt: task.dueAt ?? null,
                hasTime: task.dueHasTime === true,
                priority: task.priority === 'p2' ? null : task.priority,
                estimateMin: task.estimateMin ?? null,
              }}
            />
          ) : null}
          {full ? (
            <p className="mono-meta mono-triage-full" role="alert">
              {t('mono.triage.full')}
            </p>
          ) : null}
          <div className="mono-triage-grid">
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                className={`mono-btn ${a === 'today' ? 'mono-btn-primary' : 'mono-btn-ghost'}`}
                onClick={() => act(a)}
              >
                {t(`mono.triage.${a}` as 'mono.triage.today')}
              </button>
            ))}
          </div>
        </div>
      </MonoCard>
      <button
        type="button"
        className="mono-link-btn mono-triage-skip"
        onClick={() => setSkipped(true)}
      >
        {t('mono.triage.skip')}
      </button>
    </div>
  );
}
