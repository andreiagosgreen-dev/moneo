import { useEffect, useMemo, useState } from 'react';
import { activeProjects } from '../lib/projects';
import { loadBoardConfig, saveBoardConfig, pruneSprintTasks } from '../lib/sprints';
import type { BoardConfig } from '../lib/sprints';
import { loadAdvancedPlanning, saveAdvancedPlanning } from '../lib/advancedPlanning';
import type { AgileProps, AgileTab } from './agile/types';
import BoardTab from './agile/BoardTab';
import SprintsTab from './agile/SprintsTab';
import TimelineTab from './agile/TimelineTab';
import WaterfallTab from './agile/WaterfallTab';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const AGILE_TABS: Array<{ id: AgileTab; label: string }> = [
  { id: 'board', label: 'agile.tab.board' },
  { id: 'sprints', label: 'agile.tab.sprints' },
  { id: 'timeline', label: 'agile.tab.timeline' },
  { id: 'waterfall', label: 'agile.tab.waterfall' },
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
  const [tab, setTab] = useState<AgileTab>('timeline');
  const [board, setBoard] = useState<BoardConfig>(loadBoardConfig);
  const [advanced, setAdvanced] = useState(loadAdvancedPlanning);
  const { t } = useI18n();
  const live = useMemo(() => activeProjects(projects), [projects]);
  const projectId = selectedProjectId ?? live[0]?.id ?? null;

  const commitBoard = (next: BoardConfig) => {
    saveBoardConfig(next);
    setBoard(next);
  };

  const setAdvancedVisible = (visible: boolean) => {
    saveAdvancedPlanning(visible);
    setAdvanced(visible);
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
    <section className="card min-w-0 px-6 py-6 sm:px-7" aria-label={t('agile.aria')}>
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-cream">
            {t('agile.title')}
          </h2>
          <p className="mt-1.5 text-[13px] leading-snug text-sage">{t('agile.sub')}</p>
        </div>
        {live.length > 0 && (
          <select
            value={projectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value || null)}
            className="h-9 max-w-[180px] shrink-0 rounded-lg bg-ink/40 px-2.5 text-[13px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
            aria-label={t('agile.project')}
          >
            {live.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {!advanced ? (
        <div className="mt-4 rounded-xl bg-ink/40 px-4 py-4 ring-1 ring-inset ring-line">
          <p className="text-[13px] leading-relaxed text-sage">{t('adv.body')}</p>
          <button
            onClick={() => setAdvancedVisible(true)}
            className="press btn-ghost mt-3 rounded-lg px-4 py-2 font-mono text-[12px] font-semibold"
          >
            {t('adv.show')}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-ink/60 p-1 ring-1 ring-line">
            {AGILE_TABS.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`press shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  tab === tb.id ? 'bg-cream/10 text-cream' : 'text-sage hover:text-cream'
                }`}
              >
                {t(tb.label as TKey)}
              </button>
            ))}
            <button
              onClick={() => setAdvancedVisible(false)}
              className="press ml-auto shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold text-sage hover:text-cream"
              title={t('adv.hide')}
              aria-label={t('adv.hide')}
            >
              ✕
            </button>
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
        </>
      )}
    </section>
  );
}
