import { useMemo, useState } from 'react';
import {
  createPhaseObject,
  updatePhase,
  deletePhase,
  seedStarterPhases,
  setPhaseStatus,
  phasesForProject,
  waterfallProgress,
} from '../../lib/waterfall';
import type { WaterfallProps } from './types';

/** Sequential phases with gates: strict todo → active → done. */
export default function WaterfallTab({ projectId, phases, phasesChange }: WaterfallProps) {
  const [name, setName] = useState('');
  const [gate, setGate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGate, setEditGate] = useState('');
  const [editRisk, setEditRisk] = useState('');
  const scoped = useMemo(
    () => (projectId ? phasesForProject(phases, projectId) : []),
    [phases, projectId],
  );
  const pct = projectId ? waterfallProgress(phases, projectId) : 0;

  if (!projectId) {
    return (
      <p className="rounded-xl border border-dashed border-line/60 px-4 py-5 text-center text-[12px] text-faint">
        Create a project first — phases live on projects.
      </p>
    );
  }

  const add = () => {
    const phase = createPhaseObject(projectId, name, scoped.length, gate || undefined);
    if (!phase) return;
    phasesChange([...phases, phase]);
    setName('');
    setGate('');
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/80 ring-1 ring-line">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent-deep), var(--accent))',
            }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-sage">{pct}%</span>
      </div>

      {scoped.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-line/60 px-4 py-5 text-center">
          <p className="text-[12px] text-faint">No phases yet.</p>
          <button
            onClick={() => phasesChange(seedStarterPhases(phases, projectId))}
            className="press btn-accent mt-2 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Start classic pipeline
          </button>
        </div>
      ) : (
        <ol className="mt-3 space-y-0">
          {scoped.map((p, i) => (
            <li key={p.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < scoped.length - 1 && (
                <span
                  className={`absolute left-[7px] top-5 h-[calc(100%-16px)] w-px ${p.status === 'done' ? 'bg-accent/60' : 'bg-line'}`}
                  aria-hidden
                />
              )}
              <span
                className={`mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-2 ${
                  p.status === 'done'
                    ? 'bg-accent ring-accent'
                    : p.status === 'active'
                      ? 'bg-ink ring-accent'
                      : 'bg-ink ring-line'
                }`}
                title={p.status}
              />
              <div className="min-w-0 flex-1 rounded-xl bg-ink/40 px-3 py-2 ring-1 ring-inset ring-line">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-faint">#{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-cream">
                    {p.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(editingId === p.id ? null : p.id);
                      setEditName(p.name);
                      setEditGate(p.gate ?? '');
                      setEditRisk(p.risk ?? '');
                    }}
                    className="press shrink-0 rounded p-1 font-mono text-[10px] text-faint hover:text-cream"
                    aria-label={`Edit ${p.name}`}
                    title="Rename, gate, risk"
                  >
                    ✎
                  </button>
                  {p.status === 'todo' && (
                    <button
                      onClick={() => phasesChange(setPhaseStatus(phases, p.id, 'active'))}
                      className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                      title={
                        scoped.slice(0, i).every((x) => x.status === 'done')
                          ? 'Start phase'
                          : 'Finish earlier phases first'
                      }
                    >
                      Start
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button
                      onClick={() => phasesChange(setPhaseStatus(phases, p.id, 'done'))}
                      className="press shrink-0 rounded-md px-2 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                      title={p.gate ? `Gate: ${p.gate}` : 'Complete phase'}
                    >
                      Complete
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Delete phase “${p.name}”?`)) {
                        phasesChange(deletePhase(phases, p.id));
                      }
                    }}
                    className="press shrink-0 rounded p-1 font-mono text-[10px] text-faint hover:text-tomato"
                    aria-label={`Delete ${p.name}`}
                  >
                    ✕
                  </button>
                </div>
                {p.gate && (
                  <p className="mt-0.5 font-mono text-[10px] text-faint">Gate: {p.gate}</p>
                )}
                {p.risk && (
                  <p className="mt-0.5 font-mono text-[10px] text-tomato">Risk: {p.risk}</p>
                )}
                {editingId === p.id && (
                  <div className="mt-2 space-y-1.5 border-t border-line/60 pt-2">
                    <input
                      type="text"
                      value={editName}
                      maxLength={80}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Phase name"
                      className="h-8 w-full rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editGate}
                      maxLength={200}
                      onChange={(e) => setEditGate(e.target.value)}
                      placeholder="Exit gate…"
                      className="h-8 w-full rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editRisk}
                      maxLength={200}
                      onChange={(e) => setEditRisk(e.target.value)}
                      placeholder="Top risk…"
                      className="h-8 w-full rounded-lg bg-ink/50 px-2.5 text-[12px] text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setEditingId(null)}
                        className="press rounded-lg px-2.5 py-1.5 text-[11px] text-faint hover:text-cream"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          phasesChange(
                            updatePhase(phases, p.id, {
                              name: editName,
                              gate: editGate || null,
                              risk: editRisk || null,
                            }),
                          );
                          setEditingId(null);
                        }}
                        className="press btn-accent rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Phase name…"
          className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <input
          type="text"
          value={gate}
          maxLength={200}
          onChange={(e) => setGate(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Exit gate…"
          className="h-9 w-32 shrink-0 rounded-lg bg-ink/40 px-3 text-sm text-cream ring-1 ring-inset ring-line placeholder:text-faint focus:ring-accent focus:outline-none"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="press btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold disabled:opacity-40"
          aria-label="Add phase"
        >
          +
        </button>
      </div>
    </div>
  );
}
