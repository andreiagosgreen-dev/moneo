import MonoCard from './MonoCard';
import { QuickPills } from './MonoQuickPreview';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { Project } from '../lib/projects';
import type { Task } from '../lib/tasks';

interface Props {
  tasks: Task[];
  projects: Project[];
  onToday: (id: string) => void;
  onAssign: (id: string, projectId: string) => void;
  onDelete: (id: string) => void;
}

/** Inbox ("Cutia de idei") at the top of Projects. Hidden when empty. */
export default function MonoInbox({ tasks, projects, onToday, onAssign, onDelete }: Props) {
  const { t, fmtNum } = useI18n();
  if (tasks.length === 0) return null;
  const active = projects.filter((p) => !p.archived);
  return (
    <section
      className="mono-sec mono-pad mono-inbox"
      aria-labelledby="mono-inbox-title"
      data-testid="inbox"
    >
      <p id="mono-inbox-title" className="mono-eyebrow" style={{ marginBottom: 8 }}>
        {t('mono.inbox.count', { n: fmtNum(tasks.length) })}
      </p>
      <MonoCard style={{ padding: '4px 16px' }}>
        <ul className="mono-inbox-list">
          {tasks.map((task) => (
            <li key={task.id} className="mono-inbox-row">
              <div className="mono-list-grow">
                <div className="mono-h3">{task.title}</div>
                <QuickPills
                  q={{
                    dueAt: task.dueAt ?? null,
                    hasTime: task.dueHasTime === true,
                    priority: task.priority === 'p2' ? null : task.priority,
                    estimateMin: task.estimateMin ?? null,
                  }}
                />
              </div>
              <div className="mono-inbox-actions">
                <button
                  type="button"
                  className="mono-btn mono-btn-ghost mono-inbox-btn"
                  aria-label={t('mono.inbox.todayAria', { title: task.title })}
                  onClick={() => onToday(task.id)}
                >
                  {t('mono.inbox.today')}
                </button>
                {active.length > 0 ? (
                  <select
                    className="mono-field mono-inbox-select"
                    aria-label={t('mono.inbox.project')}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) onAssign(task.id, e.target.value);
                    }}
                  >
                    <option value="">{t('mono.inbox.project')}</option>
                    {active.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="mono-week-nav mono-inbox-del"
                  aria-label={t('mono.inbox.delete', { title: task.title })}
                  onClick={() => onDelete(task.id)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </MonoCard>
    </section>
  );
}
