import { describe, expect, it } from "vitest";
import { assembleSession, newSessionId } from "./sessions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("stable session ids", () => {
  it("generates a UUID-shaped id (or spec-shaped fallback)", () => {
    const id = newSessionId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(10);
    // In jsdom, crypto.randomUUID is available → true UUID.
    expect(UUID_RE.test(id)).toBe(true);
  });

  it("never repeats across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newSessionId()));
    expect(ids.size).toBe(200);
  });
});

describe("assembleSession", () => {
  it("returns null when there is nothing to credit", () => {
    expect(assembleSession(null)).toBeNull();
  });

  it("stamps a stable id and preserves at/min", () => {
    const entry = assembleSession({ at: 5000, min: 25 });
    expect(entry).not.toBeNull();
    expect(entry!.at).toBe(5000);
    expect(entry!.min).toBe(25);
    expect(typeof entry!.id).toBe("string");
    expect(entry!.id!.length).toBeGreaterThan(0);
  });

  it("attaches only the round-captured metadata that exists", () => {
    const withBoth = assembleSession(
      { at: 1, min: 25 },
      { intention: "Write thesis", areaId: "area:work" },
    );
    expect(withBoth).toEqual({
      id: withBoth!.id,
      at: 1,
      min: 25,
      intention: "Write thesis",
      areaId: "area:work",
    });

    const bare = assembleSession({ at: 2, min: 50 }, { intention: null, areaId: null });
    expect(bare!.intention).toBeUndefined();
    expect(bare!.areaId).toBeUndefined();
  });
});
