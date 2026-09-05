import { afterEach, describe, expect, it, vi } from "vitest";
import { getTotalFocusedMinutes } from "../growth";
import { STORAGE_KEYS } from "../storage/storageKeys";
import { DEFAULT_SETTINGS, loadHistory, saveHistory } from "../store";
import { createLocalSyncIO } from "./syncRepos";
import { runSync, type SyncRepos } from "./syncEngine";
import { loadSyncState } from "./syncState";
import { pullPaged } from "../cloud/sessionRepository";
import type { RemoteAreaRow, RemoteSessionRow, RemoteSettingsRow } from "./merge";

class MemoryStorage {
  readonly values = new Map<string, string>();
  readonly failWrites = new Set<string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failWrites.has(key)) throw new Error("storage unavailable");
    this.values.set(key, value);
  }
  seed(key: string, value: unknown) { this.values.set(key, JSON.stringify(value)); }
}

const USER = "11111111-1111-4111-8111-111111111111";
const canonical: RemoteSettingsRow = { ...DEFAULT_SETTINGS, updatedAt: 10 };

function install(storage: MemoryStorage) {
  vi.stubGlobal("localStorage", storage);
  storage.seed(STORAGE_KEYS.schemaVersion, 3);
  storage.seed(STORAGE_KEYS.settings, canonical);
  storage.seed(STORAGE_KEYS.focusAreas, []);
}

function repos(opts: {
  sessions?: RemoteSessionRow[];
  areas?: RemoteAreaRow[];
  settings?: RemoteSettingsRow | null;
  counters?: { sessions: number; areas: number; settings: number };
} = {}): SyncRepos {
  return {
    pullSessions: async () => opts.sessions ?? [],
    pullAreas: async () => opts.areas ?? [],
    pullSettings: async () => opts.settings ?? canonical,
    pushSessions: async () => { if (opts.counters) opts.counters.sessions++; return true; },
    pushAreas: async () => { if (opts.counters) opts.counters.areas++; return true; },
    pushSettings: async () => { if (opts.counters) opts.counters.settings++; return true; },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("production local sync persistence", () => {
  it("reproduces Gate 0 safely: canonical conflict stays stale, does not push, and does not mark success", async () => {
    const storage = new MemoryStorage();
    install(storage);
    storage.seed(STORAGE_KEYS.history, [{ id: "s1", at: 1, min: 25 }]);
    storage.failWrites.add(STORAGE_KEYS.history);
    const calls = { sessions: 0, areas: 0, settings: 0 };

    const result = await expect(runSync({
      userId: USER, consented: true, repos: repos({
        sessions: [{ id: "s1", at: 1, min: 50, intention: null, areaId: null }],
        counters: calls,
      }), local: createLocalSyncIO(), now: () => 4242,
    })).resolves.toMatchObject({ ok: false, stage: "apply", error: "storage" });

    expect(result).toBeDefined();
    expect(loadHistory()).toEqual([{ id: "s1", at: 1, min: 25 }]);
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
    expect(loadSyncState().initialized).toBe(false);
    expect(loadSyncState().lastSuccessfulSyncAt).toBeNull();
    expect(calls).toEqual({ sessions: 0, areas: 0, settings: 0 });
  });

  it("retries a failed canonical replacement once, then converges on two zero-op runs", async () => {
    const storage = new MemoryStorage();
    install(storage);
    storage.seed(STORAGE_KEYS.history, [{ id: "s1", at: 1, min: 25 }]);
    storage.failWrites.add(STORAGE_KEYS.history);
    const cloud = repos({ sessions: [{ id: "s1", at: 1, min: 50, intention: null, areaId: null }] });

    expect((await runSync({ userId: USER, consented: true, repos: cloud, local: createLocalSyncIO() })).ok).toBe(false);
    storage.failWrites.delete(STORAGE_KEYS.history);
    const recovered = await runSync({ userId: USER, consented: true, repos: cloud, local: createLocalSyncIO(), now: () => 10 });
    const second = await runSync({ userId: USER, consented: false, repos: cloud, local: createLocalSyncIO(), now: () => 11 });
    const third = await runSync({ userId: USER, consented: false, repos: cloud, local: createLocalSyncIO(), now: () => 12 });

    expect(recovered).toMatchObject({ ok: true, conflicts: 1, insertedSessions: 0 });
    expect(loadHistory()).toEqual([{ id: "s1", at: 1, min: 50 }]);
    expect(second).toMatchObject({ ok: true, conflicts: 0, insertedSessions: 0, adoptedSessions: 0 });
    expect(third).toMatchObject({ ok: true, conflicts: 0, insertedSessions: 0, adoptedSessions: 0 });
  });

  it("does not fake remote adoption or R4A seeded-area mapping when history persistence fails", async () => {
    const storage = new MemoryStorage();
    install(storage);
    const workCloud = "a1100000-0000-4000-8000-000000000001";
    storage.seed(STORAGE_KEYS.history, [{ id: "local", at: 1, min: 25, areaId: "area:work" }]);
    storage.seed(STORAGE_KEYS.focusAreas, [{ id: "area:work", cloudId: workCloud, name: "Work", createdAt: 1 }]);
    storage.failWrites.add(STORAGE_KEYS.history);
    const result = await runSync({ userId: USER, consented: true, repos: repos({ sessions: [
      { id: "remote", at: 2, min: 25, intention: null, areaId: workCloud },
    ] }), local: createLocalSyncIO() });

    expect(result).toMatchObject({ ok: false, stage: "apply" });
    expect(loadHistory()).toEqual([{ id: "local", at: 1, min: 25, areaId: "area:work" }]);
    expect(loadHistory().some((s) => s.areaId === workCloud)).toBe(false);
  });

  it("does not apply a complete multi-page remote pull when the final local history write fails", async () => {
    const storage = new MemoryStorage();
    install(storage);
    storage.seed(STORAGE_KEYS.history, [{ id: "keep", at: 1, min: 10 }]);
    storage.failWrites.add(STORAGE_KEYS.history);
    const all: RemoteSessionRow[] = [1, 2, 3].map((n) => ({ id: `remote-${n}`, at: n + 10, min: 5, intention: null, areaId: null }));
    const paged: SyncRepos = { ...repos(), pullSessions: () => pullPaged(async (from, to) => all.slice(from, to + 1), 1) };

    const result = await runSync({ userId: USER, consented: true, repos: paged, local: createLocalSyncIO() });
    expect(result).toMatchObject({ ok: false, stage: "apply" });
    expect(loadHistory()).toEqual([{ id: "keep", at: 1, min: 10 }]);
    expect(loadSyncState().initialized).toBe(false);
  });

  it("aborts before pull when a required local migration write fails", async () => {
    const storage = new MemoryStorage();
    install(storage);
    storage.seed(STORAGE_KEYS.schemaVersion, 2);
    storage.seed(STORAGE_KEYS.focusAreas, [{ id: "area:work", name: "Work", createdAt: 1 }]);
    storage.failWrites.add(STORAGE_KEYS.focusAreas);

    const result = await runSync({ userId: USER, consented: true, repos: repos(), local: createLocalSyncIO() });
    expect(result).toMatchObject({ ok: false, stage: "backfill", error: "Could not prepare local storage." });
    expect(loadSyncState().initialized).toBe(false);
  });

  it("propagates other sync-critical local write failures and never reports success when the marker cannot persist", async () => {
    const storage = new MemoryStorage();
    install(storage);
    storage.failWrites.add(STORAGE_KEYS.focusAreas);
    const areaResult = await runSync({ userId: USER, consented: true, repos: repos({ areas: [
      { id: "a", name: "Remote", createdAt: 1, updatedAt: 1, deletedAt: null },
    ] }), local: createLocalSyncIO() });
    expect(areaResult).toMatchObject({ ok: false, stage: "apply" });
    expect(loadSyncState().initialized).toBe(false);

    storage.failWrites.delete(STORAGE_KEYS.focusAreas);
    storage.failWrites.add(STORAGE_KEYS.syncState);
    const markerResult = await runSync({ userId: USER, consented: true, repos: repos(), local: createLocalSyncIO() });
    expect(markerResult).toMatchObject({ ok: false, stage: "apply", error: "Could not save sync state." });
    expect(loadSyncState().initialized).toBe(false);

    storage.failWrites.delete(STORAGE_KEYS.syncState);
    expect(saveHistory([{ id: "timer", at: 5, min: 25 }])).toBe(true);
    expect(loadHistory()).toEqual([{ id: "timer", at: 5, min: 25 }]);
  });
});
