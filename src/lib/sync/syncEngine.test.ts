import { describe, expect, it } from "vitest";
import type { Session, Settings } from "../store";
import type { FocusArea } from "../focusAreas";
import { SEEDED_AREA_CLOUD_IDS } from "../areaIdentity";
import { getTotalFocusedMinutes } from "../growth";
import { STORAGE_KEYS } from "../storage/storageKeys";
import type {
  RemoteAreaRow,
  RemoteSessionRow,
  RemoteSettingsRow,
} from "./merge";
import { runSync, type SyncLocalIO, type SyncRepos } from "./syncEngine";
import { loadSyncState } from "./syncState";
import {
  SESSION_PULL_PAGE_SIZE,
  pullPaged,
} from "../cloud/sessionRepository";

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

  it("resolves a same-id conflict by adopting the remote canonical payload locally", async () => {
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
    expect(res.conflicts).toBe(1); // one conflict resolved this run
    expect(res.insertedSessions).toBe(0);
    expect(res.adoptedSessions).toBe(0);
    // Local is REPLACED by the remote canonical (same id, no new UUID, no duplicate).
    expect(store.history).toEqual([{ id: sharedId, at: 1000, min: 50 }]);
    expect(store.history).toHaveLength(1);
    // Cloud row is untouched (remote was already canonical) — no duplicate pushed.
    expect(cloud.sessions).toHaveLength(1);
    expect(cloud.sessions[0].min).toBe(50);
  });

  it("terminal convergence: after resolution, second and third syncs are zero-ops", async () => {
    const sharedId = "77777777-7777-4777-8777-777777777777";
    const store = fakeLocal({ history: [{ id: sharedId, at: 1000, min: 25 }] });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 50, intention: null, areaId: null });

    // Sync 1: resolves the conflict.
    const r1 = await runSync({ userId: USER, consented: true, repos: reposFor(cloud), local: localIO(store) });
    expect(r1.ok).toBe(true);
    expect(r1.conflicts).toBe(1);
    expect(store.history[0].min).toBe(50);

    // Sync 2: identical local/cloud → zero conflict, insert, adoption, cloud write.
    const r2 = await runSync({ userId: USER, consented: false, repos: reposFor(cloud), local: localIO(store) });
    expect(r2.ok).toBe(true);
    expect(r2.conflicts).toBe(0);
    expect(r2.insertedSessions).toBe(0);
    expect(r2.adoptedSessions).toBe(0);
    expect(cloud.sessions).toHaveLength(1);

    // Sync 3: still a complete zero-op (proves terminal, not two-pass, convergence).
    const r3 = await runSync({ userId: USER, consented: false, repos: reposFor(cloud), local: localIO(store) });
    expect(r3.ok).toBe(true);
    expect(r3.conflicts).toBe(0);
    expect(r3.insertedSessions).toBe(0);
    expect(r3.adoptedSessions).toBe(0);
    expect(cloud.sessions).toHaveLength(1);
    expect(store.history).toEqual([{ id: sharedId, at: 1000, min: 50 }]);
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

describe("session conflict terminal convergence", () => {
  const sharedId = "88888888-8888-4888-8888-888888888888";

  it("each differing immutable field converges to the remote canonical payload", async () => {
    const canonical = { id: sharedId, at: 5000, min: 90, intention: "Cloud", areaId: null };
    const variants = [
      { id: sharedId, at: 1000, min: 90, intention: "Cloud" }, // timestamp differs
      { id: sharedId, at: 5000, min: 25, intention: "Cloud" }, // duration differs
      { id: sharedId, at: 5000, min: 90, intention: "Local" }, // intention differs
    ];
    for (const localRow of variants) {
      const store = fakeLocal({ history: [localRow] });
      const cloud = fakeCloud();
      cloud.sessions.push({ ...canonical });
      const res = await runSync({
        userId: USER,
        consented: true,
        repos: reposFor(cloud),
        local: localIO(store),
      });
      expect(res.ok).toBe(true);
      expect(res.conflicts).toBe(1);
      // Local replaced by canonical; exactly one entry; cloud untouched.
      expect(store.history).toHaveLength(1);
      expect(store.history[0]).toMatchObject({
        id: sharedId,
        at: 5000,
        min: 90,
        intention: "Cloud",
      });
      expect(cloud.sessions).toHaveLength(1);
    }
  });

  it("maps a local seeded area id to its cloud UUID — no false conflict", async () => {
    const workCloud = SEEDED_AREA_CLOUD_IDS["area:work"];
    const areas: FocusArea[] = [
      { id: "area:work", name: "Work", createdAt: 5, cloudId: workCloud },
    ];
    // Local references the area by LOCAL id; cloud by the cloud UUID. Same area.
    const store = fakeLocal({
      history: [{ id: sharedId, at: 1000, min: 25, areaId: "area:work" }],
      areas,
    });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 25, intention: null, areaId: workCloud });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.conflicts).toBe(0); // same cloud UUID after mapping → identical → noop
    expect(store.history[0].areaId).toBe("area:work"); // still the local id
  });

  it("a genuine area conflict resolves remote-canonical and stores the local id back", async () => {
    const workCloud = SEEDED_AREA_CLOUD_IDS["area:work"];
    const studyCloud = SEEDED_AREA_CLOUD_IDS["area:study"];
    const areas: FocusArea[] = [
      { id: "area:work", name: "Work", createdAt: 5, cloudId: workCloud },
      { id: "area:study", name: "Study", createdAt: 5, cloudId: studyCloud },
    ];
    const store = fakeLocal({
      history: [{ id: sharedId, at: 1000, min: 25, areaId: "area:work" }],
      areas,
    });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 25, intention: null, areaId: studyCloud });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.conflicts).toBe(1);
    // Remote canonical (study) wins; stored back as the LOCAL area id.
    expect(store.history[0].areaId).toBe("area:study");
  });

  it("preserves unrelated sessions, keeps length stable, and never duplicates ids", async () => {
    const store = fakeLocal({
      history: [
        { id: "other-1", at: 500, min: 10 },
        { id: sharedId, at: 1000, min: 25 },
        { id: "other-2", at: 1500, min: 20 },
      ],
    });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 50, intention: null, areaId: null });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(store.history).toHaveLength(3); // length stable
    const ids = store.history.map((s) => s.id);
    expect(new Set(ids).size).toBe(3); // no duplicate ids
    expect(store.history.find((s) => s.id === sharedId)!.min).toBe(50); // canonical
    expect(store.history.find((s) => s.id === "other-1")!.min).toBe(10); // untouched
    expect(store.history.find((s) => s.id === "other-2")!.min).toBe(20); // untouched
  });

  it("Growth reflects exactly one canonical session (no double count)", async () => {
    const store = fakeLocal({ history: [{ id: sharedId, at: 1000, min: 25 }] });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 50, intention: null, areaId: null });
    await runSync({ userId: USER, consented: true, repos: reposFor(cloud), local: localIO(store) });
    expect(store.history).toHaveLength(1); // exactly one session
    expect(getTotalFocusedMinutes(store.history)).toBe(50); // canonical, not 25+50
  });

  it("two devices converge to a single canonical session", async () => {
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 50, intention: "Canonical", areaId: null });
    const deviceA = fakeLocal({
      history: [{ id: sharedId, at: 1000, min: 25, intention: "A-version" }],
    });
    const deviceB = fakeLocal();

    // A syncs: conflict resolved to canonical.
    const rA = await runSync({ userId: USER, consented: true, repos: reposFor(cloud), local: localIO(deviceA) });
    expect(rA.conflicts).toBe(1);
    expect(deviceA.history[0]).toMatchObject({ id: sharedId, min: 50, intention: "Canonical" });

    // B syncs: pulls canonical X.
    const rB = await runSync({ userId: USER, consented: true, repos: reposFor(cloud), local: localIO(deviceB) });
    expect(rB.adoptedSessions).toBe(1);
    expect(deviceB.history[0]).toMatchObject({ id: sharedId, min: 50, intention: "Canonical" });

    // A syncs again: zero-op.
    const rA2 = await runSync({ userId: USER, consented: false, repos: reposFor(cloud), local: localIO(deviceA) });
    expect(rA2.conflicts).toBe(0);
    expect(rA2.insertedSessions).toBe(0);
    expect(rA2.adoptedSessions).toBe(0);

    // All hold exactly one canonical X with equal Growth.
    for (const d of [deviceA, deviceB]) {
      expect(d.history).toHaveLength(1);
      expect(d.history[0].id).toBe(sharedId);
      expect(getTotalFocusedMinutes(d.history)).toBe(50);
    }
    expect(cloud.sessions).toHaveLength(1);
    expect(cloud.sessions[0].min).toBe(50);
  });

  it("a failed local write during resolution prevents the success marker", async () => {
    const store = fakeLocal({ history: [{ id: sharedId, at: 1000, min: 25 }] });
    const cloud = fakeCloud();
    cloud.sessions.push({ id: sharedId, at: 1000, min: 50, intention: null, areaId: null });
    const failingLocal: SyncLocalIO = {
      readHistory: () => store.history,
      writeHistory: () => false, // storage write fails
      readAreas: () => store.areas,
      writeAreas: () => true,
      readSettings: () => store.settings,
      writeSettings: () => true,
    };
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: reposFor(cloud),
      local: failingLocal,
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("apply");
    // No success marker; retry possible; local & cloud unchanged.
    expect(loadSyncState().initialized).toBe(false);
    expect(loadSyncState().lastSuccessfulSyncAt).toBeNull();
    expect(store.history).toEqual([{ id: sharedId, at: 1000, min: 25 }]);
    expect(cloud.sessions).toHaveLength(1);
    expect(cloud.sessions[0].min).toBe(50);
  });
});

/* ------------------------------------------------------------------ */
/* R3-FINAL: pagination × sync-engine integration.                     */
/* The fake pullSessions is driven by the REAL pullPaged orchestrator  */
/* over an in-memory dataset ordered exactly like the production query */
/* (completed_at ASC, then id ASC), so page traversal, termination and */
/* failure semantics are the repository's actual behavior.             */
/* ------------------------------------------------------------------ */

function pagedRepos(
  cloud: Cloud,
  opts?: {
    pageSize?: number;
    failPageIndex?: number;
    ranges?: Array<{ from: number; to: number }>;
  },
): SyncRepos {
  const pageSize = opts?.pageSize ?? 2;
  const ranges: Array<{ from: number; to: number }> = opts?.ranges ?? [];
  return {
    pullSessions: async () => {
      let pageCalls = 0;
      const sorted = [...cloud.sessions].sort(
        (a, b) => a.at - b.at || a.id.localeCompare(b.id),
      );
      return pullPaged<RemoteSessionRow>(async (from, to) => {
        const pageIndex = pageCalls++;
        ranges.push({ from, to });
        if (opts?.failPageIndex === pageIndex) return null;
        return sorted.slice(from, to + 1);
      }, pageSize);
    },
    pushSessions: async (_userId, sessions) => {
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
    pullAreas: async () => [...cloud.areas],
    pushAreas: async (_userId, areas) => {
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
    pullSettings: async () => cloud.settings,
    pushSettings: async (_userId, settings) => {
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

describe("R3 pagination × sync engine integration", () => {
  it("runSync consumes the COMPLETE multi-page remote history — no later-page row lost", async () => {
    const cloud = fakeCloud();
    for (let i = 1; i <= 7; i++) {
      cloud.sessions.push({
        id: `pg-${i}`,
        at: i * 1000,
        min: 10 + i,
        intention: i === 6 ? "Late page intention" : null,
        areaId: null,
      });
    }
    const ranges: Array<{ from: number; to: number }> = [];
    const store = fakeLocal();
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2, ranges }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(ranges).toHaveLength(4); // 2+2+2+1 → pages [0-1],[2-3],[4-5],[6-7]
    expect(res.adoptedSessions).toBe(7);
    // Every page-1/2/3 row is in the final local history with payload intact.
    expect(store.history.map((s) => s.id).sort()).toEqual([
      "pg-1", "pg-2", "pg-3", "pg-4", "pg-5", "pg-6", "pg-7",
    ]);
    expect(store.history.find((s) => s.id === "pg-6")!.intention).toBe(
      "Late page intention",
    );
    expect(new Set(store.history.map((s) => s.id)).size).toBe(7); // no dupes
    expect(getTotalFocusedMinutes(store.history)).toBe(
      cloud.sessions.reduce((sum, s) => sum + s.min, 0),
    );
  });

  it("20,001 remote rows traverse 21 production-size pages into complete history (old 20k cap is gone)", async () => {
    expect(SESSION_PULL_PAGE_SIZE).toBe(1000);
    const cloud = fakeCloud();
    for (let i = 0; i < 20_001; i++) {
      cloud.sessions.push({
        id: `bulk-${String(i).padStart(5, "0")}`,
        at: i,
        min: 1,
        intention: null,
        areaId: null,
      });
    }
    const ranges: Array<{ from: number; to: number }> = [];
    const store = fakeLocal();
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: SESSION_PULL_PAGE_SIZE, ranges }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(ranges).toHaveLength(21); // 20 full pages + one 1-row page
    expect(ranges[0]).toEqual({ from: 0, to: 999 });
    expect(ranges[20]).toEqual({ from: 20_000, to: 20_999 });
    expect(res.adoptedSessions).toBe(20_001); // nothing truncated at 20,000
    expect(store.history).toHaveLength(20_001);
    expect(new Set(store.history.map((s) => s.id)).size).toBe(20_001);
    expect(getTotalFocusedMinutes(store.history)).toBe(20_001);
  });

  it("local-only sessions survive and are pushed while a multi-page remote is adopted", async () => {
    const cloud = fakeCloud();
    for (let i = 1; i <= 3; i++) {
      cloud.sessions.push({ id: `r-${i}`, at: i * 100, min: 5, intention: null, areaId: null });
    }
    const store = fakeLocal({
      history: [{ id: "local-only", at: 50, min: 25, intention: "Mine" }],
    });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2 }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.adoptedSessions).toBe(3);
    expect(res.insertedSessions).toBe(1); // local-only pushed per policy
    // Complete remote pull deletes nothing: 3 remote + 1 local-only.
    expect(store.history).toHaveLength(4);
    expect(store.history.find((s) => s.id === "local-only")).toMatchObject({
      min: 25,
      intention: "Mine",
    });
    expect(cloud.sessions.map((s) => s.id).sort()).toEqual([
      "local-only", "r-1", "r-2", "r-3",
    ]);
  });

  it("R2 regression: a same-id conflict on a LATER page converges terminally", async () => {
    const conflictId = "99999999-9999-4999-8999-999999999999";
    const cloud = fakeCloud();
    cloud.sessions.push({ id: "page-1-row", at: 100, min: 5, intention: null, areaId: null });
    cloud.sessions.push({ id: conflictId, at: 5000, min: 90, intention: "Cloud canonical", areaId: null }); // page 2
    const store = fakeLocal({
      history: [{ id: conflictId, at: 1000, min: 25, intention: "Local stale" }],
    });
    const first = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 1 }),
      local: localIO(store),
    });
    expect(first.ok).toBe(true);
    expect(first.conflicts).toBe(1); // pagination reached the later page
    // Remote canonical replaced local; page-1 row adopted; no duplicates.
    expect(store.history).toHaveLength(2);
    expect(store.history.find((s) => s.id === conflictId)).toMatchObject({
      at: 5000,
      min: 90,
      intention: "Cloud canonical",
    });
    expect(cloud.sessions).toHaveLength(2);

    const second = await runSync({
      userId: USER,
      consented: false,
      repos: pagedRepos(cloud, { pageSize: 1 }),
      local: localIO(store),
    });
    expect(second.conflicts).toBe(0); // terminal convergence
    expect(second.insertedSessions).toBe(0);
    expect(second.adoptedSessions).toBe(0);
    expect(store.history).toHaveLength(2);
    expect(cloud.sessions).toHaveLength(2);
  });

  it("R1 regression: a later-page session referencing a seeded cloud area UUID maps to the local id with no false conflict", async () => {
    const workCloud = SEEDED_AREA_CLOUD_IDS["area:work"];
    const cloud = fakeCloud();
    cloud.sessions.push({ id: "other-row", at: 100, min: 5, intention: null, areaId: null }); // page 1
    cloud.sessions.push({ id: "shared", at: 1000, min: 25, intention: null, areaId: workCloud }); // page 2
    const store = fakeLocal({
      history: [{ id: "shared", at: 1000, min: 25, areaId: "area:work" }],
      areas: [{ id: "area:work", name: "Work", createdAt: 5, cloudId: workCloud }],
    });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 1 }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.conflicts).toBe(0); // local id vs cloud UUID compare equal after mapping
    expect(res.adoptedSessions).toBe(1);
    expect(store.history.find((s) => s.id === "shared")!.areaId).toBe("area:work");
    expect(store.history.map((s) => s.id).sort()).toEqual(["other-row", "shared"]);
  });

  it("a later-page failure aborts runSync — no partial apply, no success mark, local untouched", async () => {
    const cloud = fakeCloud();
    for (let i = 1; i <= 5; i++) {
      cloud.sessions.push({ id: `f-${i}`, at: i * 100, min: 5, intention: null, areaId: null });
    }
    const preExisting: Session = { id: "keep-me", at: 9000, min: 10 };
    const store = fakeLocal({ history: [{ ...preExisting }] });
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2, failPageIndex: 2 }), // page 3 fails
      local: localIO(store),
    });
    expect(res.ok).toBe(false);
    expect(res.stage).toBe("pull");
    // The two successful pages are NOT applied as if complete.
    expect(store.history).toEqual([preExisting]);
    expect(cloud.sessions).toHaveLength(5); // nothing pushed
    expect(loadSyncState().initialized).toBe(false);
    expect(loadSyncState().lastSuccessfulSyncAt).toBeNull();
  });

  it("retry after a later-page failure completes with no duplicates and advances the marker", async () => {
    const cloud = fakeCloud();
    for (let i = 1; i <= 5; i++) {
      cloud.sessions.push({ id: `f-${i}`, at: i * 100, min: 5, intention: null, areaId: null });
    }
    const store = fakeLocal({ history: [{ id: "keep-me", at: 9000, min: 10 }] });

    const failed = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2, failPageIndex: 2 }),
      local: localIO(store),
    });
    expect(failed.ok).toBe(false);

    const ok = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2 }),
      local: localIO(store),
      now: () => 4242,
    });
    expect(ok.ok).toBe(true);
    expect(ok.adoptedSessions).toBe(5);
    expect(store.history).toHaveLength(6); // 5 remote + 1 pre-existing
    expect(new Set(store.history.map((s) => s.id)).size).toBe(6); // no duplicates
    expect(loadSyncState().initialized).toBe(true);
    expect(loadSyncState().lastSuccessfulSyncAt).toBe(4242);

    const again = await runSync({
      userId: USER,
      consented: false,
      repos: pagedRepos(cloud, { pageSize: 2 }),
      local: localIO(store),
    });
    expect(again.adoptedSessions).toBe(0);
    expect(again.insertedSessions).toBe(0);
    expect(again.conflicts).toBe(0);
    expect(store.history).toHaveLength(6);
  });

  it("an exact page-multiple dataset terminates via one final empty request (no infinite loop)", async () => {
    const cloud = fakeCloud();
    for (let i = 1; i <= 4; i++) {
      cloud.sessions.push({ id: `e-${i}`, at: i * 100, min: 5, intention: null, areaId: null });
    }
    const ranges: Array<{ from: number; to: number }> = [];
    const store = fakeLocal();
    const res = await runSync({
      userId: USER,
      consented: true,
      repos: pagedRepos(cloud, { pageSize: 2, ranges }),
      local: localIO(store),
    });
    expect(res.ok).toBe(true);
    expect(res.adoptedSessions).toBe(4);
    expect(ranges).toEqual([
      { from: 0, to: 1 },
      { from: 2, to: 3 },
      { from: 4, to: 5 }, // empty final page proves completion
    ]);
    expect(store.history).toHaveLength(4);
  });

  it("ordering is deterministic (completed_at ASC, id ASC) and unique ids never inflate history", async () => {
    const mkCloud = (): Cloud => {
      const c = fakeCloud();
      // Deliberately unsorted input with EQUAL timestamps but distinct ids.
      c.sessions.push(
        { id: "b", at: 500, min: 5, intention: null, areaId: null },
        { id: "z-first", at: 100, min: 5, intention: null, areaId: null },
        { id: "a", at: 500, min: 5, intention: null, areaId: null },
        { id: "c", at: 500, min: 5, intention: null, areaId: null },
      );
      return c;
    };
    const expectedOrder = ["z-first", "a", "b", "c"];

    const runOnce = async () => {
      const ranges: Array<{ from: number; to: number }> = [];
      const store = fakeLocal();
      const res = await runSync({
        userId: USER,
        consented: true,
        repos: pagedRepos(mkCloud(), { pageSize: 1, ranges }),
        local: localIO(store),
      });
      expect(res.ok).toBe(true);
      // Strictly increasing, non-overlapping page ranges.
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].from).toBe(ranges[i - 1].to + 1);
      }
      // Stable deterministic order end-to-end, including the id tie-breaker.
      expect(store.history.map((s) => s.id)).toEqual(expectedOrder);
      expect(new Set(store.history.map((s) => s.id)).size).toBe(4); // one entry per id
      return store.history.map((s) => s.id).join(",");
    };

    const first = await runOnce();
    const second = await runOnce();
    expect(first).toBe(second); // identical runs → identical result
  });
});
