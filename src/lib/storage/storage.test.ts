import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "./storageKeys";
import {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  safeRead,
  safeRemove,
  safeWrite,
  setSchemaVersion,
} from "./storageAdapter";
import { runLocalMigrations } from "./migrations";
import { getTotalFocusedMinutes } from "../growth";
import { currentStreak } from "../store";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("centralized storage keys", () => {
  it("pins the exact product key values (legacy keys never renamed)", () => {
    expect(STORAGE_KEYS).toEqual({
      settings: "solanum:settings",
      history: "solanum:history",
      snapshot: "solanum:snapshot",
      intentionDraft: "moneo:intention-draft",
      focusAreas: "moneo:focus-areas",
      selectedFocusArea: "moneo:selected-focus-area",
      schemaVersion: "moneo:schema-version",
      syncState: "moneo:sync-state",
    });
  });
});

describe("schema versioning", () => {
  it("is at version 2", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it("treats malformed markers as legacy", () => {
    expect(getSchemaVersion()).toBeNull(); // absent marker = legacy
    localStorage.setItem(STORAGE_KEYS.schemaVersion, '"v1"');
    expect(getSchemaVersion()).toBeNull();
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "{nope");
    expect(getSchemaVersion()).toBeNull();
    localStorage.setItem(STORAGE_KEYS.schemaVersion, "-3");
    expect(getSchemaVersion()).toBeNull();
  });
});

describe("migration runner", () => {
  it("migrates a legacy (unmarked) installation to the current version", () => {
    const res = runLocalMigrations();
    expect(res.status).toBe("migrated");
    expect(res.from).toBeNull();
    expect(res.to).toBe(CURRENT_SCHEMA_VERSION);
    expect(getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("is idempotent on repeated startups", () => {
    runLocalMigrations();
    const again = runLocalMigrations();
    expect(again.status).toBe("already-current");
    expect(again.from).toBe(CURRENT_SCHEMA_VERSION);
    expect(getSchemaVersion()).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("preserves an unsupported future version untouched", () => {
    setSchemaVersion(99);
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify([{ at: 1, min: 25 }]));
    const res = runLocalMigrations();
    expect(res.status).toBe("unsupported-version");
    expect(getSchemaVersion()).toBe(99); // never downgraded
    expect(safeRead<unknown>(STORAGE_KEYS.history)).toEqual([{ at: 1, min: 25 }]);
  });

  it("does not advance the marker when persisting fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const res = runLocalMigrations();
    expect(res.status).toBe("failed");
    vi.restoreAllMocks();
    expect(getSchemaVersion()).toBeNull();
  });

  it("stays calm when storage is entirely unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => runLocalMigrations()).not.toThrow();
    expect(safeRead<unknown>(STORAGE_KEYS.settings)).toBeNull();
    expect(safeWrite(STORAGE_KEYS.settings, {})).toBe(false);
    expect(() => safeRemove(STORAGE_KEYS.settings)).not.toThrow();
  });
});

describe("legacy payloads remain readable after migration", () => {
  it("settings survive (including default fill)", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ focusMin: 30 }));
    runLocalMigrations();
    expect(safeRead<Record<string, unknown>>(STORAGE_KEYS.settings)).toEqual({
      focusMin: 30,
    });
  });

  it("intention-less history survives migration with at/min/order intact", () => {
    // Since schema v2, migration backfills stable ids onto legacy entries —
    // the protected invariants are at, min and order (ids are additive).
    const legacy = [{ at: 1000, min: 25 }, { at: 2000, min: 50 }];
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(legacy));
    runLocalMigrations();
    const migrated = safeRead<Array<{ id?: string; at: number; min: number }>>(
      STORAGE_KEYS.history,
    )!;
    expect(migrated.map(({ at, min }) => ({ at, min }))).toEqual(legacy);
    expect(migrated.every((s) => typeof s.id === "string" && s.id.length > 0)).toBe(true);
  });

  it("intention draft survives", () => {
    localStorage.setItem(STORAGE_KEYS.intentionDraft, JSON.stringify("Write thesis"));
    runLocalMigrations();
    expect(safeRead<unknown>(STORAGE_KEYS.intentionDraft)).toBe("Write thesis");
  });

  it("focus areas and selected area survive", () => {
    const areas = [{ id: "a1", name: "Thesis", createdAt: 5 }];
    localStorage.setItem(STORAGE_KEYS.focusAreas, JSON.stringify(areas));
    localStorage.setItem(STORAGE_KEYS.selectedFocusArea, JSON.stringify("a1"));
    runLocalMigrations();
    expect(safeRead<unknown>(STORAGE_KEYS.focusAreas)).toEqual(areas);
    expect(safeRead<unknown>(STORAGE_KEYS.selectedFocusArea)).toBe("a1");
  });
});

describe("legacy session-id backfill (schema v2)", () => {
  it("assigns one id per legacy session, preserving order and every field", () => {
    const legacy = [
      { at: 1000, min: 25, intention: "A", areaId: "area:work" },
      { at: 2000, min: 50 },
      { at: 3000, min: 15, intention: "B" },
    ];
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(legacy));
    runLocalMigrations();
    const migrated = safeRead<Array<Record<string, unknown>>>(STORAGE_KEYS.history)!;
    expect(migrated).toHaveLength(3);
    // at/min/intention/areaId/order all unchanged
    expect(migrated.map((s) => ({ ...s, id: undefined }))).toEqual(
      legacy.map((s) => ({ ...s, id: undefined })),
    );
    const ids = migrated.map((s) => s.id as string);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(3); // unique
  });

  it("is idempotent — a second run changes nothing", () => {
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([{ at: 1000, min: 25 }]),
    );
    runLocalMigrations();
    const once = localStorage.getItem(STORAGE_KEYS.history);
    runLocalMigrations();
    const twice = localStorage.getItem(STORAGE_KEYS.history);
    expect(twice).toBe(once);
  });

  it("preserves ids that sessions already have", () => {
    const existing = "11111111-1111-4111-8111-111111111111";
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([
        { id: existing, at: 1000, min: 25 },
        { at: 2000, min: 50 },
      ]),
    );
    runLocalMigrations();
    const migrated = safeRead<Array<{ id: string }>>(STORAGE_KEYS.history)!;
    expect(migrated[0].id).toBe(existing);
    expect(migrated[1].id).not.toBe(existing);
  });

  it("leaves corrupt history bytes untouched and still advances safely", () => {
    localStorage.setItem(STORAGE_KEYS.history, "{{{not json");
    const res = runLocalMigrations();
    expect(res.status).toBe("migrated");
    expect(localStorage.getItem(STORAGE_KEYS.history)).toBe("{{{not json");
  });

  it("does not change Growth totals or streak statistics", () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      d.setHours(12, 0, 0, 0);
      return d.getTime();
    };
    const legacy = [
      { at: day(0), min: 25 },
      { at: day(1), min: 50, intention: "Thesis" },
    ];
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(legacy));
    const beforeTotal = getTotalFocusedMinutes(legacy);
    const beforeStreak = currentStreak(legacy);
    runLocalMigrations();
    const migrated = safeRead<Array<{ at: number; min: number; intention?: string }>>(
      STORAGE_KEYS.history,
    )!;
    expect(getTotalFocusedMinutes(migrated)).toBe(beforeTotal);
    expect(currentStreak(migrated)).toBe(beforeStreak);
  });

  it("does not advance the marker when the backfilled history cannot be saved", () => {
    localStorage.setItem(
      STORAGE_KEYS.history,
      JSON.stringify([{ at: 1000, min: 25 }]),
    );
    const real = Storage.prototype.setItem;
    let calls = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      calls++;
      if (key === STORAGE_KEYS.history && calls > 0) {
        throw new Error("quota exceeded");
      }
      return real.call(this, key, value);
    });
    const res = runLocalMigrations();
    expect(res.status).toBe("failed");
    vi.restoreAllMocks();
    expect(getSchemaVersion()).toBeNull(); // never falsely advanced
  });
});
