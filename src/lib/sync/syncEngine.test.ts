import { beforeEach, describe, expect, it } from "vitest";
import type { Session, Settings } from "../store";
import type { FocusArea } from "../focusAreas";
import { getTotalFocusedMinutes } from "../growth";
import { STORAGE_KEYS } from "../storage/storageKeys";
import type {
  RemoteAreaRow,
  RemoteSessionRow,
  RemoteSettingsRow,
} from "./merge";
import { runSync, type SyncLocalIO, type SyncRepos } from "./syncEngine";
import { loadSyncState } from "./syncState";

/* ---------- fake cloud + fake local stores (deterministic harness) ---------- */

interface Cloud {
  sessions: RemoteSessionRow[];
  areas: RemoteAreaRow[];
  settings: RemoteSettingsRow | null;
}

function fakeCloud(): Cloud {
  return { sessions: [], areas: [], settings: null };
}

interface LocalStore {
  history: Session[];
  areas: FocusArea[];
  settings: Settings;
}

function fakeLocal(init?: Partial<LocalStore>): LocalStore {
  return {
    history: init?.history ?? [],
    areas: init?.areas ?? [],
    settings: init?.settings ?? {
      focusMin: 25,
      shortMin: 5,
      longMin: 15,
      longEvery: 4,
      dailyGoal: 8,
      autoStart: false,
      sound: true,
    },
  };
}

function localIO(store: LocalStore): SyncLocalIO {
  return {
    readHistory: () => store.history,
    writeHistory: (h) => {
      store.history = h;
      return true;
    },
    readAreas: () => store.areas,
    writeAreas: (a) => {
      store.areas = a;
      return true;
    },
    readSettings: () => store.settings,
    writeSettings: (s) => {
      store.settings = s;
      return true;
    },
  };
}

function reposFor(
  cloud: Cloud,
  opts?: {
    failPull?: boolean;
    failPushSessions?: boolean;
    calls?: string[];
    pushedSessions?: Array<{ id: string; at: number; min: number; intention?: string; areaId?: string }>;
    pushedAreas?: FocusArea[];
    pushedSettings?: Settings[];
  },
): SyncRepos {
  const record = (name: string) => opts?.calls?.push(name);
  return {
    pullSessions: async () => {
      record("pullSessions");
      if (opts?.failPull) return null;
      return [...cloud.sessions];
    },
    pushSessions: async (_userId, sessions) => {
      record("pushSessions");
      if (opts?.failPushSessions) return false;
      opts?.pushedSessions?.push(...sessions);
      for (const s of sessions) {
        if (!cloud.sessions.some((c) => c.id === s.id)) {
          cloud.sessions.push({
            id: s.id,
            at: s.at,
            min: s.min,
            intention: s.intention ?? null,
            areaId: s.areaId ?? null,
          });
        }
      }
      return true;
    },
    pullAreas: async () => {
      record("pullAreas");
      if (opts?.failPull) return null;
      return [...cloud.areas];
    },
    pushAreas: async (_userId, areas) => {
      record("pushAreas");
      opts?.pushedAreas?.push(...areas);
      for (const a of areas) {
        const existing = cloud.areas.find((c) => c.id === a.id);
        const row: RemoteAreaRow = {
          id: a.id,
          name: a.name,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt ?? a.createdAt,
          deletedAt: typeof a.deletedAt === "number" ? a.deletedAt : null,
        };
        if (existing) Object.assign(existing, row);
        else cloud.areas.push(row);
      }
      return true;
    },
    pullSettings: async () => {
      record("pullSettings");
      if (opts?.failPull) return null;
      return cloud.settings;
    },
    pushSettings: async (_userId, settings) => {
      record("pushSettings");
      opts?.pushedSettings?.push(settings);
      cloud.settings = {
        focusMin: settings.focusMin,
        shortMin: settings.shortMin,
        longMin: settings.longMin,
        longEvery: settings.longEvery,
        dailyGoal: settings.dailyGoal,
        autoStart: settings.autoStart,
        sound: settings.sound,
        updatedAt: settings.updatedAt ?? Date.now(),
      };
      return true;
    },
  };
}

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  localStorage.clear();
});

describe("gates: auth + consent", () => {
  it("refuses unsigned users with zero repo calls", async () => {
    const calls: string[] = [];
    const cloud = fakeCloud();
    const res = await runSync({
      userId: null,
      consented: true,
      repos: reposFor(cloud, { calls }),
      local: localIO(fakeLocal()),
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("auth");
    expect(calls).toEqual([]);
  });

  it("requires explicit consent before the FIRST sync", async () => {
    const calls: string[] = [];
    const cloud = fakeCloud();
    const res = await runSync({
      userId: USER,
      consented: false,
      repos: reposFor(cloud, { calls }),
      local: localIO(fakeLocal({ history: [{ at: 1, min: 25 }] })),
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("consent");
    expect(calls).toEqual([]); // zero product-data touches pre-consent
    expect(loadSyncState().initialized).toBe(false);
  });

  it("consent is no longer required once initialized", async () => {
    localStorage.setItem(
      STORAGE_KEYS.syncState,
      JSON.stringify({
        version: 1,
        initialized: true,
        lastSuccessfulSyncAt: 10,
        deviceId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    const calls: string[] = [];
    const res = await runSync({
      userId: USER,
      consented: false,
      repos: reposFor(fakeCloud(), { calls }),
      local: localIO(fakeLocal()),
    });
    expect(res.ok).toBe(true);
    expect(calls).toContain("pullSessions");
  });
});

describe("success / failure semantics", () => {
  it("success marks initialized and stamps lastSuccessfulSyncAt", async () => {
    const store = fakeLocal({ history: [{ at: 1000, min: 25 }] });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(fakeCloud()),
      local: localIO(store),
      now: () => 777_000,
    });
    expect(res.ok).toBe(true);
    expect(res.stage).toBe("done");
    expect(res.state?.initialized).toBe(true);
    expect(res.state?.lastSuccessfulSyncAt).toBe(777_000);
    expect(loadSyncState().initialized).toBe(true);
  });

  it("a failed pull leaves sync state untouched and local intact", async () => {
    const store = fakeLocal({ history: [{ at: 1000, min: 25 }] });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(fakeCloud(), { failPull: true }),
      local: localIO(store),
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("pull");
    expect(loadSyncState().initialized).toBe(false);
    expect(loadSyncState().lastSuccessfulSyncAt).toBeNull();
    // Content fully preserved (the pre-pull backfill may additively stamp an id).
    expect(store.history).toHaveLength(1);
    expect(store.history.map(({ at, min }) => ({ at, min }))).toEqual([
      { at: 1000, min: 25 },
    ]);
  });

  it("a failed push keeps local data safe and sync un-initialized", async () => {
    const store = fakeLocal({
      history: [{ id: "33333333-3333-4333-8333-333333333333", at: 1000, min: 25 }],
    });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(fakeCloud(), { failPushSessions: true }),
      local: localIO(store),
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("push");
    expect(loadSyncState().initialized).toBe(false);
    expect(store.history).toHaveLength(1);
    expect(store.history[0].min).toBe(25);
  });

  it("never throws even when every repo rejects; local stays intact", async () => {
    const store = fakeLocal({ history: [{ at: 1000, min: 25 }] });
    const throwing: SyncRepos = {
      pullSessions: async () => {
        throw new Error("boom");
      },
      pushSessions: async () => {
        throw new Error("boom");
      },
      pullAreas: async () => {
        throw new Error("boom");
      },
      pushAreas: async () => {
        throw new Error("boom");
      },
      pullSettings: async () => {
        throw new Error("boom");
      },
      pushSettings: async () => {
        throw new Error("boom");
      },
    };
    let res: Awaited<ReturnType<typeof runSync>> | undefined;
    await expect(
      (async () => {
        res = await runSync({
          userId: USER,
          consented: true,
          repos: throwing,
          local: localIO(store),
        });
      })(),
    ).resolves.toBeUndefined();
    expect(res!.ok).toBe(false);
    expect(store.history).toHaveLength(1);
    expect(store.history.map(({ at, min }) => ({ at, min }))).toEqual([
      { at: 1000, min: 25 },
    ]);
    expect(loadSyncState().initialized).toBe(false);
  });
});

describe("backfill + idempotence", () => {
  it("backfills ids onto legacy sessions and pushes them with those ids", async () => {
    const store = fakeLocal({
      history: [
        { at: 1000, min: 25 },
        { at: 2000, min: 50, intention: "Thesis" },
      ],
    });
    const pushed: Array<{ id: string; at: number; min: number; intention?: string; areaId?: string }> = [];
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(fakeCloud(), { pushedSessions: pushed }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    // Every local entry now has exactly one stable id; order/at/min preserved.
    expect(store.history.map(({ at, min }) => ({ at, min }))).toEqual([
      { at: 1000, min: 25 },
      { at: 2000, min: 50 },
    ]);
    expect(
      store.history.every((s) => typeof s.id === "string" && s.id.length > 0),
    ).toBe(true);
    // Pushed rows carry the very same ids.
    expect(pushed.map((p) => p.id)).toEqual(store.history.map((s) => s.id));
    expect(res.insertedSessions).toBe(2);
  });

  it("is fully idempotent — a second run is a zero-op", async () => {
    const store = fakeLocal({ history: [{ at: 1000, min: 25 }] });
    const cloud = fakeCloud();
    const first = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
      now: () => 500,
    });
    expect(first.ok).toBe(true);
    expect(first.insertedSessions).toBe(1);

    const second = await runSync({
      userId: USER,
      consented: false,
      repos: reposFor(cloud),
      local: localIO(store),
      now: () => 900,
    });
    expect(second.ok).toBe(true);
    expect(second.insertedSessions).toBe(0);
    expect(second.adoptedSessions).toBe(0);
    expect(second.pushedAreas).toBe(0);
    expect(second.settingsOp).toBe("noop");
    expect(second.conflicts).toBe(0);
    expect(cloud.sessions).toHaveLength(1); // no duplicates
  });
});

describe("merge behavior", () => {
  it("adopts remote-only sessions and keeps history ordered by time", async () => {
    const store = fakeLocal({
      history: [{ id: "44444444-4444-4444-8444-444444444444", at: 1000, min: 25 }],
    });
    const cloud = fakeCloud();
    cloud.sessions.push({
      id: "55555555-5555-4555-8555-555555555555",
      at: 1500,
      min: 30,
      intention: null,
      areaId: null,
    });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.adoptedSessions).toBe(1);
    expect(store.history.map((s) => s.at)).toEqual([1000, 1500]);
    expect(store.history[1].id).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("counts same-id conflicts, preserves local, and never duplicates", async () => {
    const sharedId = "66666666-6666-4666-8666-666666666666";
    const store = fakeLocal({ history: [{ id: sharedId, at: 1000, min: 25 }] });
    const cloud = fakeCloud();
    cloud.sessions.push({
      id: sharedId,
      at: 1000,
      min: 50, // conflicting immutable payload
      intention: null,
      areaId: null,
    });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.conflicts).toBe(1);
    expect(res.insertedSessions).toBe(0);
    // Local entry preserved as-is; remote canonical; no duplicate rows.
    expect(store.history).toEqual([{ id: sharedId, at: 1000, min: 25 }]);
    expect(cloud.sessions).toHaveLength(1);
    expect(cloud.sessions[0].min).toBe(50);
  });

  it("merges areas: newer wins, deletion propagates, remote-only adopted", async () => {
    const store = fakeLocal({
      areas: [
        { id: "a1", name: "Local New", createdAt: 10, updatedAt: 100 }, // local newer
        { id: "a2", name: "Old Local", createdAt: 10, updatedAt: 100 }, // remote newer
        { id: "a3", name: "Gone", createdAt: 10, updatedAt: 100 }, // remote deleted, newer
      ],
    });
    const cloud = fakeCloud();
    cloud.areas.push(
      { id: "a1", name: "Old Cloud", createdAt: 10, updatedAt: 50, deletedAt: null },
      { id: "a2", name: "Remote Wins", createdAt: 10, updatedAt: 200, deletedAt: null },
      { id: "a3", name: "Gone", createdAt: 10, updatedAt: 200, deletedAt: 150 },
      { id: "a4", name: "CloudOnly", createdAt: 20, updatedAt: 20, deletedAt: null },
    );
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    const byId = new Map(store.areas.map((a) => [a.id, a]));
    expect(byId.get("a1")!.name).toBe("Local New"); // local newer → pushed
    expect(byId.get("a2")!.name).toBe("Remote Wins"); // remote newer applied
    expect(byId.get("a3")!.deletedAt).toBe(150); // deletion merged
    expect(byId.get("a4")!.name).toBe("CloudOnly"); // adopted
    expect(cloud.areas.some((a) => a.id === "a1" && a.name === "Local New")).toBe(true);
    expect(res.pushedAreas).toBeGreaterThanOrEqual(1);
    expect(res.appliedRemoteAreas).toBeGreaterThanOrEqual(2);
  });

  it("settings: local-newer pushes, remote-newer applies, equal no-ops", async () => {
    // local newer → push
    const localNewer = fakeLocal();
    localNewer.settings = { ...localNewer.settings, focusMin: 30, updatedAt: 300 };
    const cloudA = fakeCloud();
    cloudA.settings = {
      focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4,
      dailyGoal: 8, autoStart: false, sound: true, updatedAt: 100,
    };
    const resA = await runSync({
      userId: USER, consented: true,
      repos: reposFor(cloudA), local: localIO(localNewer),
    });
    expect(resA.settingsOp).toBe("pushLocal");
    expect(cloudA.settings!.focusMin).toBe(30);

    // remote newer → apply locally
    const remoteNewer = fakeLocal();
    remoteNewer.settings = { ...remoteNewer.settings, updatedAt: 100 };
    const cloudB = fakeCloud();
    cloudB.settings = {
      focusMin: 45, shortMin: 5, longMin: 15, longEvery: 4,
      dailyGoal: 8, autoStart: false, sound: true, updatedAt: 500,
    };
    const resB = await runSync({
      userId: USER, consented: true,
      repos: reposFor(cloudB), local: localIO(remoteNewer),
    });
    expect(resB.settingsOp).toBe("applyRemote");
    expect(remoteNewer.settings.focusMin).toBe(45);
    expect(remoteNewer.settings.updatedAt).toBe(500);

    // equal → noop
    const equal = fakeLocal();
    equal.settings = { ...equal.settings, updatedAt: 400 };
    const cloudC = fakeCloud();
    cloudC.settings = {
      focusMin: equal.settings.focusMin, shortMin: 5, longMin: 15,
      longEvery: 4, dailyGoal: 8, autoStart: false, sound: true, updatedAt: 400,
    };
    const resC = await runSync({
      userId: USER, consented: true,
      repos: reposFor(cloudC), local: localIO(equal),
    });
    expect(resC.settingsOp).toBe("noop");
  });
});

describe("two-device convergence", () => {
  it("A1 + B1 converge exactly once on both devices with equal Growth", async () => {
    const cloud = fakeCloud();
    const deviceA = fakeLocal({
      history: [{ at: 1000, min: 25, intention: "A one" }],
    });
    const deviceB = fakeLocal();

    // A syncs first.
    const r1 = await runSync({
      userId: USER, consented: true,
      repos: reposFor(cloud), local: localIO(deviceA),
    });
    expect(r1.ok).toBe(true);
    expect(cloud.sessions).toHaveLength(1);

    // B pulls A1, then records B1 locally.
    const r2 = await runSync({
      userId: USER, consented: true,
      repos: reposFor(cloud), local: localIO(deviceB),
    });
    expect(r2.adoptedSessions).toBe(1);
    deviceB.history = [
      ...deviceB.history,
      { at: 2000, min: 50, intention: "B one" },
    ];
    const r3 = await runSync({
      userId: USER, consented: false,
      repos: reposFor(cloud), local: localIO(deviceB),
    });
    expect(r3.insertedSessions).toBe(1);
    expect(cloud.sessions).toHaveLength(2);

    // A syncs again and adopts B1.
    const r4 = await runSync({
      userId: USER, consented: false,
      repos: reposFor(cloud), local: localIO(deviceA),
    });
    expect(r4.adoptedSessions).toBe(1);

    // Both devices: A1 + B1 exactly once, ordered, equal Growth.
    for (const d of [deviceA, deviceB]) {
      expect(d.history.map((s) => s.at)).toEqual([1000, 2000]);
      const ids = d.history.map((s) => s.id);
      expect(new Set(ids).size).toBe(2);
      expect(getTotalFocusedMinutes(d.history)).toBe(75);
    }
    expect(new Set(cloud.sessions.map((s) => s.id)).size).toBe(2);
    expect(getTotalFocusedMinutes(deviceA.history)).toBe(
      getTotalFocusedMinutes(deviceB.history),
    );
  });
});

describe("privacy boundaries", () => {
  it("pushes ONLY sessions/areas/settings — never drafts or snapshots", async () => {
    // Seed device-only data that must never leave the browser.
    localStorage.setItem(STORAGE_KEYS.intentionDraft, JSON.stringify("secret draft"));
    localStorage.setItem(
      STORAGE_KEYS.snapshot,
      JSON.stringify({ mode: "focus", total: 1500, remaining: 700, cycle: 1 }),
    );

    const store = fakeLocal({
      history: [{ at: 1000, min: 25, intention: "Thesis", areaId: "a1" }],
      areas: [{ id: "a1", name: "Study", createdAt: 5 }],
    });
    const pushedSessions: Array<{ id: string; at: number; min: number; intention?: string; areaId?: string }> = [];
    const pushedAreas: FocusArea[] = [];
    const pushedSettings: Settings[] = [];
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(fakeCloud(), { pushedSessions, pushedAreas, pushedSettings }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);

    const allowedSessionKeys = new Set(["id", "at", "min", "intention", "areaId"]);
    for (const row of pushedSessions) {
      expect(new Set(Object.keys(row))).toEqual(allowedSessionKeys);
      expect(JSON.stringify(row)).not.toContain("secret draft");
      expect(JSON.stringify(row)).not.toContain("remaining");
    }
    for (const a of pushedAreas) {
      expect(new Set(Object.keys(a))).toEqual(
        new Set(["id", "name", "createdAt"]),
      );
    }
    for (const s of pushedSettings) {
      expect(JSON.stringify(s)).not.toContain("secret draft");
      expect(s).not.toHaveProperty("remaining");
      expect(s).not.toHaveProperty("endsAt");
    }
  });
});
