import { useEffect, useMemo, useRef, useState } from 'react';
import type { NavTab } from './TopNav';
import { PRIMARY_TABS, SECONDARY_TABS } from './TopNav';
import type { Task } from '../lib/tasks';
import type { Project } from '../lib/projects';
import type { Goal } from '../lib/goals';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

const ALL_TABS = [...PRIMARY_TABS, ...SECONDARY_TABS];

interface PaletteItem {
  key: string;
  kind: TKey;
  title: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onTab: (t: NavTab) => void;
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  running: boolean;
  onToggleTimer: () => void;
  onSelectProject: (id: string) => void;
  onSelectTask: (id: string, projectId: string) => void;
}

export default function CommandPalette({
  open,
  onClose,
  onTab,
  tasks,
  projects,
  goals,
  running,
  onToggleTimer,
  onSelectProject,
  onSelectTask,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: PaletteItem[] = [];

    const timerTitle = running ? t('palette.pauseTimer') : t('palette.startTimer');
    if (q.length === 0 || timerTitle.toLowerCase().includes(q)) {
      out.push({
        key: 'action-timer',
        kind: 'nav.kind.action',
        title: timerTitle,
        run: onToggleTimer,
      });
    }

    for (const tb of ALL_TABS) {
      const title = t('palette.goTo', { section: t(tb.label) });
      if (q.length > 0 && !title.toLowerCase().includes(q) && !t(tb.label).toLowerCase().includes(q)) {
        continue;
      }
      out.push({ key: `tab-${tb.id}`, kind: 'nav.kind.action', title, run: () => onTab(tb.id) });
    }

    if (q.length >= 2) {
      for (const p of projects) {
        if (!p.archived && p.name.toLowerCase().includes(q)) {
          out.push({
            key: `p-${p.id}`,
            kind: 'nav.kind.project',
            title: p.name,
            run: () => onSelectProject(p.id),
          });
        }
      }
      for (const x of tasks) {
        if (x.status !== 'completed' && x.title.toLowerCase().includes(q)) {
          out.push({
            key: `t-${x.id}`,
            kind: 'nav.kind.task',
            title: x.title,
            run: () => onSelectTask(x.id, x.projectId),
          });
        }
      }
      for (const g of goals) {
        if (!g.archived && g.title.toLowerCase().includes(q)) {
          out.push({ key: `g-${g.id}`, kind: 'nav.kind.goal', title: g.title, run: () => onTab('plan') });
        }
      }
    }

    return out.slice(0, 9);
  }, [query, tasks, projects, goals, running, t, onTab, onToggleTimer, onSelectProject, onSelectTask]);

  useEffect(() => setHighlight(0), [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (items.length > 0 ? (h + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (items.length > 0 ? (h - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[highlight];
        if (item) {
          item.run();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, highlight, onClose]);

  if (!open) return null;

  return (
    <div
      className="backdrop-fade fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/70 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.title')}
        className="card dialog-pop w-full max-w-lg overflow-hidden p-0"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('palette.placeholder')}
          aria-label={t('palette.title')}
          className="w-full border-b border-line bg-transparent px-5 py-4 text-[15px] text-cream placeholder:text-faint focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 ? (
            <p className="px-4 py-3.5 text-[12px] text-faint">{t('nav.searchEmpty')}</p>
          ) : (
            items.map((item, i) => (
              <li key={item.key}>
                <button
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    i === highlight ? 'bg-cream/10' : ''
                  }`}
                >
                  <span className="shrink-0 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-faint ring-1 ring-inset ring-line">
                    {t(item.kind)}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-cream/90">{item.title}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
