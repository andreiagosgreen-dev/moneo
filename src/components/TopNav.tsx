import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from './BrandMark';
import AccountButton from './AccountButton';
import type { Task } from '../lib/tasks';
import type { Project } from '../lib/projects';
import type { Goal } from '../lib/goals';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';

export type NavTab =
  'focus' | 'today' | 'plan' | 'growth' | 'map' | 'projects' | 'reports' | 'settings';

const NAV_TABS: Array<{ id: Exclude<NavTab, 'settings'>; label: TKey; hint: TKey }> = [
  { id: 'focus', label: 'nav.focus', hint: 'nav.hint.focus' },
  { id: 'today', label: 'nav.today', hint: 'nav.hint.today' },
  { id: 'plan', label: 'nav.plan', hint: 'nav.hint.plan' },
  { id: 'growth', label: 'nav.growth', hint: 'nav.hint.growth' },
  { id: 'map', label: 'nav.map', hint: 'nav.hint.map' },
  { id: 'projects', label: 'nav.projects', hint: 'nav.hint.projects' },
  { id: 'reports', label: 'nav.reports', hint: 'nav.hint.reports' },
];

interface SearchHit {
  key: string;
  kind: TKey;
  title: string;
}

interface Props {
  tab: NavTab;
  onTab: (t: NavTab) => void;
  /** e.g. "2h 5m" — focused time today. */
  todayText: string;
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
}

export default function TopNav({ tab, onTab, todayText, tasks, projects, goals }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [scrollEdge, setScrollEdge] = useState<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });

  const hits: SearchHit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchHit[] = [];
    for (const p of projects) {
      if (p.name.toLowerCase().includes(q))
        out.push({ key: `p-${p.id}`, kind: 'nav.kind.project', title: p.name });
    }
    for (const t of tasks) {
      if (t.title.toLowerCase().includes(q))
        out.push({ key: `t-${t.id}`, kind: 'nav.kind.task', title: t.title });
    }
    for (const g of goals) {
      if (!g.archived && g.title.toLowerCase().includes(q)) {
        out.push({ key: `g-${g.id}`, kind: 'nav.kind.goal', title: g.title });
      }
    }
    return out.slice(0, 6);
  }, [query, tasks, projects, goals]);

  useEffect(() => setHighlight(0), [hits.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !el?.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  // Mobile nav discoverability (Roadmap Faza 2): the tab strip can overflow
  // horizontally on narrow screens. A static edge fade is too easy to miss,
  // so this only shows a fade on whichever side still has hidden tabs, and
  // clears it once the user has scrolled all the way to that edge.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setScrollEdge({
        left: el.scrollLeft > 4,
        right: el.scrollLeft < maxScroll - 4,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Keep the active section visible: switching tabs (including via
  // keyboard shortcuts elsewhere in the app) scrolls it into view instead
  // of leaving the user to guess it moved off-screen.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  const go = (hit?: SearchHit) => {
    void hit;
    onTab('plan');
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <nav className="topnav" aria-label={t('nav.main')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('nav.home')}>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card2/80"
            style={{ boxShadow: '0 8px 24px -8px rgb(var(--accent-rgb) / 0.45)' }}
          >
            <BrandMark />
          </span>
          <span className="hidden flex-col leading-none min-[420px]:flex">
            <span className="font-display text-[17px] font-extrabold tracking-tight text-cream">
              Moneo
            </span>
            <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
              {t('nav.brandSub')}
            </span>
          </span>
        </Link>

        <div className="relative min-w-0 flex-1">
          <div
            ref={tabsRef}
            className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1"
            role="tablist"
            aria-label={t('nav.sections')}
          >
            {NAV_TABS.map((tb) => (
              <button
                key={tb.id}
                ref={tab === tb.id ? activeTabRef : undefined}
                role="tab"
                aria-selected={tab === tb.id}
                title={t(tb.hint)}
                onClick={() => onTab(tb.id)}
                data-active={tab === tb.id}
                className="navtab"
              >
                {t(tb.label)}
              </button>
            ))}
          </div>
          {scrollEdge.left && <div className="tabs-edge-fade tabs-edge-fade-left" aria-hidden />}
          {scrollEdge.right && <div className="tabs-edge-fade tabs-edge-fade-right" aria-hidden />}
        </div>

        <div ref={boxRef} className="relative hidden shrink-0 md:block">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && hits.length > 0) {
                e.preventDefault();
                setHighlight((h) => (h + 1) % hits.length);
              } else if (e.key === 'ArrowUp' && hits.length > 0) {
                e.preventDefault();
                setHighlight((h) => (h - 1 + hits.length) % hits.length);
              } else if (e.key === 'Enter') {
                go(hits[highlight]);
              }
            }}
            placeholder={t('nav.search')}
            aria-label={t('nav.searchLabel')}
            className="h-9 w-44 rounded-xl border border-line bg-ink/60 px-3 text-[13px] text-cream ring-1 ring-inset ring-transparent transition-all placeholder:text-faint focus:w-56 focus:border-accent/50 focus:outline-none"
          />
          {open && query.trim().length >= 2 && (
            <div className="searchpop" role="listbox" aria-label={t('nav.searchResults')}>
              {hits.length === 0 ? (
                <p className="px-4 py-3.5 text-[12px] text-faint">{t('nav.searchEmpty')}</p>
              ) : (
                <ul className="max-h-64 overflow-y-auto p-1.5">
                  {hits.map((h, i) => (
                    <li key={h.key}>
                      <button
                        role="option"
                        aria-selected={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => go(h)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                          i === highlight ? 'bg-cream/10' : ''
                        }`}
                      >
                        <span className="shrink-0 rounded-md bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-faint ring-1 ring-inset ring-line">
                          {t(h.kind)}
                        </span>
                        <span className="min-w-0 truncate text-[13px] text-cream/90">
                          {h.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <span
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-card/80 py-1.5 pl-2.5 pr-3 font-mono text-[12px] text-sage lg:flex"
          title={t('nav.todayPillTitle')}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          {t('nav.todayPill')}&nbsp;<span className="font-semibold text-cream">{todayText}</span>
        </span>

        <Link
          to="/help"
          title={t('nav.helpTitle')}
          aria-label={t('nav.helpLabel')}
          className="press btn-ghost hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-[15px] font-bold sm:flex"
        >
          ?
        </Link>
        <button
          onClick={() => onTab('settings')}
          title={t('nav.settingsTitle')}
          aria-label={t('nav.settingsLabel')}
          aria-pressed={tab === 'settings'}
          className={`press btn-ghost flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            tab === 'settings' ? 'text-accent' : ''
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <span className="shrink-0">
          <AccountButton />
        </span>
      </div>
    </nav>
  );
}
