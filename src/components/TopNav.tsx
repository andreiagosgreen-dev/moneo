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
  | 'focus'
  | 'today'
  | 'plan'
  | 'assistant'
  | 'growth'
  | 'map'
  | 'projects'
  | 'reports'
  | 'graph'
  | 'settings';

export const PRIMARY_TABS: Array<{ id: Exclude<NavTab, 'settings'>; label: TKey; hint: TKey }> = [
  { id: 'focus', label: 'nav.focus', hint: 'nav.hint.focus' },
  { id: 'today', label: 'nav.today', hint: 'nav.hint.today' },
  { id: 'plan', label: 'nav.plan', hint: 'nav.hint.plan' },
  { id: 'assistant', label: 'nav.assistant', hint: 'nav.hint.assistant' },
];

export const SECONDARY_TABS: Array<{ id: Exclude<NavTab, 'settings'>; label: TKey; hint: TKey }> =
  [
    { id: 'growth', label: 'nav.growth', hint: 'nav.hint.growth' },
    { id: 'map', label: 'nav.map', hint: 'nav.hint.map' },
    { id: 'projects', label: 'nav.projects', hint: 'nav.hint.projects' },
    { id: 'reports', label: 'nav.reports', hint: 'nav.hint.reports' },
    { id: 'graph', label: 'nav.graph', hint: 'nav.hint.graph' },
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
  onOpenPalette: () => void;
}

export default function TopNav({
  tab,
  onTab,
  todayText,
  tasks,
  projects,
  goals,
  onOpenPalette,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const isSecondaryActive = SECONDARY_TABS.some((tb) => tb.id === tab);

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
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

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

        <div
          className="no-scrollbar tabs-scroll -mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1"
          role="tablist"
          aria-label={t('nav.sections')}
        >
          {PRIMARY_TABS.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              aria-selected={tab === tb.id}
              title={t(tb.hint)}
              onClick={() => onTab(tb.id)}
              data-active={tab === tb.id}
              className="navtab shrink-0"
            >
              {t(tb.label)}
            </button>
          ))}
        </div>

        <div ref={moreRef} className="relative shrink-0">
          <button
            role="tab"
            aria-selected={isSecondaryActive}
            aria-expanded={moreOpen}
            aria-label={t('nav.moreLabel')}
            onClick={() => setMoreOpen((v) => !v)}
            data-active={isSecondaryActive}
            className="navtab flex items-center gap-1"
          >
            {t('nav.more')}
            <span className="text-[9px]" aria-hidden>
              ▾
            </span>
          </button>
          {moreOpen && (
            <div className="searchpop right-0" role="menu" aria-label={t('nav.moreLabel')}>
              <div className="flex flex-col gap-0.5 p-1.5">
                {SECONDARY_TABS.map((tb) => (
                  <button
                    key={tb.id}
                    role="menuitem"
                    title={t(tb.hint)}
                    onClick={() => {
                      onTab(tb.id);
                      setMoreOpen(false);
                    }}
                    className={`rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                      tab === tb.id ? 'bg-cream/10 text-cream' : 'text-cream/90 hover:bg-cream/5'
                    }`}
                  >
                    {t(tb.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onOpenPalette}
          title={t('palette.title')}
          aria-label={t('palette.title')}
          className="press hidden shrink-0 items-center gap-1.5 rounded-lg border border-line bg-ink/40 px-2 py-1.5 font-mono text-[10px] text-faint hover:text-cream sm:flex"
        >
          ⌘K
        </button>

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
