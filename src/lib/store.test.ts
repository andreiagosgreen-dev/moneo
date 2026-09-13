import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  currentStreak,
  fmtClock,
  fmtMinutes,
  isToday,
  loadHistory,
  loadSettings,
  loadSnapshot,
  minutesOnDay,
  saveSettings,
  saveSnapshot,
} from "./store";

describe("settings duration limits", () => {
  it("clamps out-of-range values on load", () => {
    saveSettings({
      focusMin: 999,
      shortMin: 0,
      longMin: -5,
      longEvery: 1,
      dailyGoal: 99,
      autoStart: true,
      sound: false,
    });
    const s = loadSettings();
    expect(s.focusMin).toBe(120);
    expect(s.shortMin).toBe(1);
    expect(s.longMin).toBe(1);
    expect(s.longEvery).toBe(2);
    expect(s.dailyGoal).toBe(20);
    expect(s.autoStart).toBe(true);
    expect(s.sound).toBe(false);
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem("solanum:settings", "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("fills missing fields with defaults (legacy/partial payloads)", () => {
    localStorage.setItem("solanum:settings", JSON.stringify({ focusMin: 30 }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, focusMin: 30 });
  });
});

describe("snapshot restoration", () => {
  it("round-trips a valid snapshot", () => {
    saveSnapshot({ mode: "short", total: 300, remaining: 120, cycle: 2 });
    expect(loadSnapshot()).toEqual({
      mode: "short",
      total: 300,
      remaining: 120,
      cycle: 2,
    });
  });

  it("clamps out-of-range snapshot fields", () => {
    saveSnapshot({ mode: "focus", total: 10, remaining: 999, cycle: 99 });
    expect(loadSnapshot()).toEqual({
      mode: "focus",
      total: 60,
      remaining: 60,
      cycle: 8,
    });
  });

  it("rejects unknown modes and corrupt payloads", () => {
    localStorage.setItem(
      "solanum:snapshot",
      JSON.stringify({ mode: "brk", total: 300, remaining: 100, cycle: 0 }),
    );
    expect(loadSnapshot()).toBeNull();
    localStorage.setItem("solanum:snapshot", "!!");
    expect(loadSnapshot()).toBeNull();
  });
});

describe("history validation", () => {
  it("keeps valid entries and drops malformed ones", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([
        { at: 1000, min: 25 },
        { at: "x", min: 25 },
        { at: 2000 },
        null,
        { at: 3000, min: 50 },
      ]),
    );
    expect(loadHistory()).toEqual([
      { at: 1000, min: 25 },
      { at: 3000, min: 50 },
    ]);
  });

  it("treats corrupt history as empty", () => {
    localStorage.setItem("solanum:history", "{{{");
    expect(loadHistory()).toEqual([]);
  });

  it("keeps legacy entries without intention/areaId exactly as before", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([{ at: 1000, min: 25 }]),
    );
    const loaded = loadHistory();
    expect(loaded).toEqual([{ at: 1000, min: 25 }]);
    expect(loaded[0]).not.toHaveProperty("intention");
    expect(loaded[0]).not.toHaveProperty("areaId");
  });

  it("preserves a valid areaId alongside intention", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([
        { at: 1000, min: 25, intention: "Ch. 2", areaId: "area:thesis" },
      ]),
    );
    expect(loadHistory()).toEqual([
      { at: 1000, min: 25, intention: "Ch. 2", areaId: "area:thesis" },
    ]);
  });

  it("drops an invalid areaId without losing the session", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([{ at: 1000, min: 25, areaId: 7 }]),
    );
    expect(loadHistory()).toEqual([{ at: 1000, min: 25 }]);
  });

  it("preserves a valid stable id alongside other fields", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          at: 1000,
          min: 25,
          intention: "Ch. 2",
          areaId: "area:thesis",
        },
      ]),
    );
    expect(loadHistory()).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        at: 1000,
        min: 25,
        intention: "Ch. 2",
        areaId: "area:thesis",
      },
    ]);
  });

  it("drops an invalid id without losing the session", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([{ id: 42, at: 1000, min: 25 }]),
    );
    expect(loadHistory()).toEqual([{ at: 1000, min: 25 }]);
  });
});

describe("streak calculation (local days)", () => {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  };
  const sessions = (offsets: number[]) =>
    offsets.map((o) => ({ at: day(o), min: 25 }));

  it("counts consecutive days ending today", () => {
    expect(currentStreak(sessions([0, 1, 2]))).toBe(3);
  });

  it("stops at a gap", () => {
    expect(currentStreak(sessions([0, 2]))).toBe(1);
  });

  it("survives an empty today via yesterday", () => {
    expect(currentStreak(sessions([1, 2]))).toBe(2);
  });

  it("is zero with no history", () => {
    expect(currentStreak([])).toBe(0);
  });
});

describe("daily focus-minute aggregation", () => {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  };

  it("sums minutes for the requested local day only", () => {
    const hist = [
      { at: day(0), min: 25 },
      { at: day(0), min: 50 },
      { at: day(1), min: 10 },
    ];
    expect(minutesOnDay(hist, new Date())).toBe(75);
  });

  it("isToday matches only the current local day", () => {
    expect(isToday(day(0))).toBe(true);
    expect(isToday(day(1))).toBe(false);
  });
});

describe("formatting", () => {
  it("formats clock values and minute summaries", () => {
    expect(fmtClock(1500)).toEqual({ mm: "25", ss: "00" });
    expect(fmtClock(59)).toEqual({ mm: "00", ss: "59" });
    expect(fmtMinutes(59)).toBe("59m");
    expect(fmtMinutes(60)).toBe("1h");
    expect(fmtMinutes(85)).toBe("1h 25m");
  });
});
