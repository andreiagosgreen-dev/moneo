import { useEffect, useMemo, useState } from 'react';
import { activeProjects } from '../lib/projects';
import { loadBoardConfig, saveBoardConfig, pruneSprintTasks } from '../lib/sprints';
import type { BoardConfig } from '../lib/sprints';
import type { AgileProps, AgileTab } from './agile/types';
import BoardTab from './agile/BoardTab';
import SprintsTab from './agile/SprintsTab';
import TimelineTab from './agile/TimelineTab';
import WaterfallTab from './agile/WaterfallTab';

const AGILE_TABS: Array<{ id: AgileTab; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'waterfall', label: 'Waterfall' },
];

export default function AgileCard({
  projects,
  tasks,
  onTasksChange,
  sprints,
  sprintsChange,
  phases,
  phasesChange,
  selectedProjectId,
  onSelectProject,
  isPro = false,
}: AgileProps) {
  const [tab, setTab] = useState<AgileTab>('board');
  const [board, setBoard] = useState<BoardConfig>(loadBoardConfig);
  const live = useMemo(() => activeProjects(projects), [projects]);
  const projectId = selectedProjectId ?? live[0]?.id ?? null;

  const commitBoard = (next: BoardConfig) => {
    saveBoardConfig(next);
    setBoard(next);
  };

  // Hygiene: drop sprint refs to deleted tasks (once per tasks change).
  useEffect(() => {
    const pruned = pruneSprintTasks(sprints, tasks);
    if (pruned.some((s, i) => s.taskIds.length !== sprints[i]?.taskIds.length)) {
      sprintsChange(pruned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <section className="card px-6 py-6 sm:px-7" aria-label="Agile board and sprints">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">Agile</h2>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
            Kanban · sprints · timeline · gated phases
          </p>
        </div>
        {live.length > 0 && (
          <select
            value={projectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value || null)}
            className="h-8 max-w-[150px] rounded-lg bg-ink/40 px-2 text-[12px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label="Board project"
          >
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="mt-4 flex gap-1 rounded-xl bg-ink/60 p-1 ring-1 ring-line w-fit">
        {AGILE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              tab === t.id ? 'bg-cream/10 text-cream' : 'text-faint hover:text-sage'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'board' && (
          <BoardTab
            projectId={projectId}
            tasks={tasks}
            onTasksChange={onTasksChange}
            board={board}
            commitBoard={commitBoard}
            isPro={isPro}
          />
        )}
        {tab === 'sprints' && (
          <SprintsTab
            projectId={projectId}
            tasks={tasks}
            onTasksChange={onTasksChange}
            sprints={sprints}
            sprintsChange={sprintsChange}
            isPro={isPro}
          />
        )}
        {tab === 'timeline' && <TimelineTab projectId={projectId} tasks={tasks} />}
        {tab === 'waterfall' && (
          <WaterfallTab projectId={projectId} phases={phases} phasesChange={phasesChange} />
        )}
      </div>
    </section>
  );
}
