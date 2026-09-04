import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "./storage/storageKeys";
import { runLocalMigrations } from "./storage/migrations";
import { safeRead } from "./storage/storageAdapter";
import {
  SEEDED_AREA_CLOUD_IDS,
  ensureAreaCloudId,
  isUuid,
} from "./areaIdentity";
import {
  createFocusArea,
  loadFocusAreas,
  markAreaDeleted,
  renameFocusArea,
  resolveCloudAreaId,
  resolveLocalAreaId,
  saveFocusAreas,
  type FocusArea,
} from "./focusAreas";

beforeEach(() => {
  localStorage.clear();
});

/* ---------- identity helpers ---------- */

describe("ensureAreaCloudId", () => {
  it("maps each seeded id to a valid, well-known cloud UUID", () => {
    for (const id of ["area:work", "area:study", "area:personal"]) {
      const cloudId = ensureAreaCloudId(id);
      expect(isUuid(cloudId)).toBe(true);
      expect(cloudId).toBe(
        SEEDED_AREA_CLOUD_IDS[id as keyof typeof SEEDED_AREA_CLOUD_IDS],
      );
    }
  });

  it("the three seeded cloud UUIDs are distinct", () => {
    const set = new Set(Object.values(SEEDED_AREA_CLOUD_IDS));
    expect(set.size).toBe(3);
  });

  it("a custom UUID local id is its own cloud id", () => {
    const uuid = "123e4567-e89b-42d3-a456-426614174000";
    expect(ensureAreaCloudId(uuid)).toBe(uuid);
  });

  it("a non-UUID, non-seeded id gets a generated UUID", () => {
    const cloudId = ensureAreaCloudId("area-custom-fallback");
    expect(isUuid(cloudId)).toBe(true);
  });

  it("seeded mapping is deterministic (identical across calls/devices)", () => {
    expect(ensureAreaCloudId("area:work")).toBe(ensureAreaCloudId("area:work"));
  });
});

/* ---------- seeding / creation / load ---------- */

describe("seeding and creation stamp a stable cloudId", () => {
  it("seeded defaults carry their well-known cloud UUIDs", () => {
    const areas = loadFocusAreas();
    const byId = new Map(areas.map((a) => [a.id, a]));
    expect(byId.get("area:work")!.cloudId).toBe(SEEDED_AREA_CLOUD_IDS["area:work"]);
    expect(byId.get("area:study")!.cloudId).toBe(SEEDED_AREA_CLOUD_IDS["area:study"]);
    expect(byId.get("area:personal")!.cloudId).toBe(SEEDED_AREA_CLOUD_IDS["area:personal"]);
  });

  it("two independent devices seed the SAME cloud ids (no duplicate defaults)", () => {
    const deviceA = loadFocusAreas();
    localStorage.clear(); // simulate a second, independent device
    const deviceB = loadFocusAreas();
    for (let i = 0; i < deviceA.length; i++) {
      expect(deviceA[i].id).toBe(deviceB[i].id);
      expect(deviceA[i].cloudId).toBe(deviceB[i].cloudId);
      expect(isUuid(deviceA[i].cloudId)).toBe(true);
    }
  });

  it("a custom area's cloudId equals its UUID id and survives reload", () => {
    const created = createFocusArea([], "Thesis")!;
    const area = created[0];
    expect(isUuid(area.id)).toBe(true);
    expect(area.cloudId).toBe(area.id);
    saveFocusAreas(created);
    const reloaded = loadFocusAreas();
    expect(reloaded[0].cloudId).toBe(area.id);
  });
});

/* ---------- migration ---------- */

describe("v2 -> v3 migration backfills cloudId", () => {
  it("assigns the well-known UUID to a legacy seeded area (matches fresh seed)", () => {
    localStorage.setItem(
      STORAGE_KEYS.focusAreas,
      JSON.stringify([{ id: "area:work", name: "Work", createdAt: 5 }]),
    );
    runLocalMigrations();
    const stored = safeRead<Array<FocusArea>>(STORAGE_KEYS.focusAreas)!;
    expect(stored[0].cloudId).toBe(SEEDED_AREA_CLOUD_IDS["area:work"]);
    // A fresh install seeds the identical cloud id -> no duplicate in cloud.
    expect(stored[0].cloudId).toBe(ensureAreaCloudId("area:work"));
  });

  it("keeps a legacy custom UUID area's own id as cloudId", () => {
    const uuid = "abcdef01-2345-4678-9abc-def012345678";
    localStorage.setItem(
      STORAGE_KEYS.focusAreas,
      JSON.stringify([{ id: uuid, name: "Custom", createdAt: 5 }]),
    );
    runLocalMigrations();
    const stored = safeRead<Array<FocusArea>>(STORAGE_KEYS.focusAreas)!;
    expect(stored[0].cloudId).toBe(uuid);
  });

  it("is idempotent — a second run changes nothing", () => {
    localStorage.setItem(
      STORAGE_KEYS.focusAreas,
      JSON.stringify([{ id: "area:study", name: "Study", createdAt: 5 }]),
    );
    runLocalMigrations();
    const first = safeRead<Array<FocusArea>>(STORAGE_KEYS.focusAreas)!;
    runLocalMigrations();
    const second = safeRead<Array<FocusArea>>(STORAGE_KEYS.focusAreas)!;
    expect(second).toEqual(first);
    expect(second[0].cloudId).toBe(first[0].cloudId);
  });

  it("preserves name/createdAt and never rewrites session.areaId", () => {
    localStorage.setItem(
      STORAGE_KEYS.focusAreas,
      JSON.stringify([{ id: "area:personal", name: "Personal", createdAt: 9 }]),
    );
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([{ id: "s1", at: 1000, min: 25, areaId: "area:personal" }]),
    );
    runLocalMigrations();
    const areas = safeRead<Array<FocusArea>>(STORAGE_KEYS.focusAreas)!;
    expect(areas[0].name).toBe("Personal");
    expect(areas[0].createdAt).toBe(9);
    // Local history still references the LOCAL id, untouched.
    const history = safeRead<Array<{ areaId: string }>>(STORAGE_KEYS.history)!;
    expect(history[0].areaId).toBe("area:personal");
  });

  it("legacy payload stays readable and corruption still falls back", () => {
    localStorage.setItem(
      STORAGE_KEYS.focusAreas,
      JSON.stringify([{ id: "area:work", name: "Work", createdAt: 5 }]),
    );
    runLocalMigrations();
    expect(loadFocusAreas().map((a) => a.name)).toEqual(["Work"]);

    localStorage.setItem(STORAGE_KEYS.focusAreas, "{corrupt");
    expect(loadFocusAreas().map((a) => a.name)).toEqual(["Work", "Study", "Personal"]);
  });
});

/* ---------- local <-> cloud resolution ---------- */

describe("session <-> area resolution", () => {
  it("maps each seeded session.areaId to its Work/Study/Personal cloud UUID", () => {
    const areas = loadFocusAreas();
    expect(resolveCloudAreaId(areas, "area:work")).toBe(SEEDED_AREA_CLOUD_IDS["area:work"]);
    expect(resolveCloudAreaId(areas, "area:study")).toBe(SEEDED_AREA_CLOUD_IDS["area:study"]);
    expect(resolveCloudAreaId(areas, "area:personal")).toBe(SEEDED_AREA_CLOUD_IDS["area:personal"]);
  });

  it("maps a custom UUID session.areaId to itself", () => {
    const areas = createFocusArea([], "Thesis")!;
    const id = areas[0].id;
    expect(resolveCloudAreaId(areas, id)).toBe(id);
  });

  it("an unresolved area resolves to an explicit null (never a local id)", () => {
    const areas = loadFocusAreas();
    expect(resolveCloudAreaId(areas, "area:does-not-exist")).toBeNull();
    expect(resolveCloudAreaId(areas, null)).toBeNull();
    expect(resolveCloudAreaId(areas, undefined)).toBeNull();
  });

  it("resolves a cloud UUID back to the local area id", () => {
    const areas = loadFocusAreas();
    const workCloud = SEEDED_AREA_CLOUD_IDS["area:work"];
    expect(resolveLocalAreaId(areas, workCloud)).toBe("area:work");
  });

  it("resolves a custom area's cloud UUID back to its local id", () => {
    const areas = createFocusArea([], "Thesis")!;
    const id = areas[0].id; // cloudId === id
    expect(resolveLocalAreaId(areas, id)).toBe(id);
  });

  it("an unknown cloud UUID resolves to null", () => {
    const areas = loadFocusAreas();
    expect(resolveLocalAreaId(areas, "99999999-9999-4999-8999-999999999999")).toBeNull();
  });
});

/* ---------- rename / delete keep identity ---------- */

describe("rename and delete never change cloud identity", () => {
  it("rename changes only the name, not id or cloudId", () => {
    const areas = loadFocusAreas();
    const before = areas.find((a) => a.id === "area:work")!;
    const renamed = renameFocusArea(areas, "area:work", "Job")!;
    const after = renamed.find((a) => a.id === "area:work")!;
    expect(after.name).toBe("Job");
    expect(after.id).toBe(before.id);
    expect(after.cloudId).toBe(before.cloudId);
  });

  it("soft-delete preserves cloudId and keeps history + Growth intact", () => {
    const areas = createFocusArea([], "Thesis")!;
    const cloudId = areas[0].cloudId;
    const marked = markAreaDeleted(areas, areas[0].id, 42);
    expect(marked[0].cloudId).toBe(cloudId);
    expect(marked[0].deletedAt).toBe(42);
    // Mapping remains stable for historical semantics.
    expect(resolveCloudAreaId(marked, areas[0].id)).toBe(cloudId);
  });
});

/* ---------- sync duplicate prevention ---------- */

describe("cloud upsert convergence (no duplicate default areas)", () => {
  it("simulated two-device push of seeded areas converges to one row each", () => {
    // Upsert keyed by cloud id, as pushAreaBatch does.
    const cloudRows = new Map<string, { id: string; name: string }>();
    const upsert = (areas: FocusArea[]) => {
      for (const a of areas) {
        const rowId = a.cloudId ?? a.id; // mirrors pushAreaBatch
        cloudRows.set(rowId, { id: rowId, name: a.name });
      }
    };

    const deviceA = loadFocusAreas();
    localStorage.clear();
    const deviceB = loadFocusAreas();

    upsert(deviceA);
    upsert(deviceB); // same logical areas, second device

    // Exactly one cloud row per default area, not two.
    expect(cloudRows.size).toBe(3);
    expect(cloudRows.get(SEEDED_AREA_CLOUD_IDS["area:work"])?.name).toBeDefined();
    expect(cloudRows.get(SEEDED_AREA_CLOUD_IDS["area:study"])?.name).toBeDefined();
    expect(cloudRows.get(SEEDED_AREA_CLOUD_IDS["area:personal"])?.name).toBeDefined();
  });
});
