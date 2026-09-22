import { useState } from 'react';
import type { Project } from '../../lib/projects';
import { getMinutesForProject } from '../../lib/projects';
import type { Session } from '../../lib/store';
import { ChevronIcon, UndoIcon } from './icons';
import { useI18n } from '../../lib/i18n/LocaleContext';

export interface ArchivedSectionProps {
  archived: Project[];
  history: Session[];
  onRestore: (id: string) => void;
}

/** Collapsible archived-projects list (moved verbatim out of ProjectsCard). */
export default function ArchivedSection({ archived, history, onRestore }: ArchivedSectionProps) {
  const { t, fmtNum, fmtDur } = useI18n();
  const [showArchived, setShowArchived] = useState(false);
  if (archived.length === 0) return null;
  return (
    <div className="mt-4 border-t border-line/60 pt-3">
      <button
        onClick={() => setShowArchived(!showArchived)}
        className="press flex w-full items-center justify-between py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-faint hover:text-sage"
      >
        <span>{t('proj.archived', { n: fmtNum(archived.length) })}</span>
        <ChevronIcon open={showArchived} />
      </button>
      {showArchived && (
        <div className="mt-2 space-y-1.5">
          {archived.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 opacity-70"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate text-[13px] font-medium text-cream/80">
                  {project.name}
                </span>
                <span className="font-mono text-[10px] text-faint">
                  {fmtDur(getMinutesForProject(project.id, history))}
                </span>
              </div>
              <button
                onClick={() => onRestore(project.id)}
                className="press flex items-center gap-1 rounded p-1 text-[11px] text-faint hover:text-sage"
                title={t('proj.restoreTitle')}
              >
                <UndoIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
