import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "./store";
import { loadHistory } from "./store";
import {
  getGrowthProgress,
  getGrowthStage,
  getGrowthSummary,
  getTodayFocusedMinutes,
  getTotalFocusedMinutes,
  getWeeklyFocusedMinutes,
} from "./growth";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

const s = (min: number, at = day(0)): Session => ({ at, min });

beforeEach(() => {
  localStorage.clear();
});

describe("growth source of truth", () => {
  it("is zero with no history", () => {
    expect(getGrowthSummary([])).toEqual({
      total: 0,
      today: 0,
      week: 0,
      stage: 0,
      stageName: "Seed",
      progress: 0,
    });
  });

  it("aggregates total focused minutes from completed sessions", () => {
    expect(getTotalFocusedMinutes([s(25), s(50), s(10)])).toBe(85);
  });

  it("ignores invalid entries through existing history validation", () => {
    localStorage.setItem(
      "solanum:history",
      JSON.stringify([{ at: 1, min: 25 }, { at: "x", min: 999 }, null]),
    );
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
  });

  it("is deterministic for identical history", () => {
    const h = [s(25), s(35, day(1))];
    expect(getGrowthSummary(h)).toEqual(getGrowthSummary([...h]));
  });
});

describe("growth stages", () => {
  it("boundary: 59 minutes is still stage 0", () => {
    expect(getGrowthStage(59)).toBe(0);
  });

  it("boundary: 60 minutes enters stage 1", () => {
    expect(getGrowthStage(60)).toBe(1);
  });

  it("boundary: 239 stays stage 1, 240 enters stage 2", () => {
    expect(getGrowthStage(239)).toBe(1);
    expect(getGrowthStage(240)).toBe(2);
  });

  it("boundary: 599 stays stage 2, 600 enters stage 3", () => {
    expect(getGrowthStage(599)).toBe(2);
    expect(getGrowthStage(600)).toBe(3);
  });

  it("max stage holds for any larger total", () => {
    expect(getGrowthStage(10_000)).toBe(3);
    expect(getGrowthProgress(10_000)).toBe(1);
  });
});

describe("growth progress within a stage", () => {
  it("is 0 at each stage start", () => {
    expect(getGrowthProgress(0)).toBe(0);
    expect(getGrowthProgress(60)).toBe(0);
    expect(getGrowthProgress(240)).toBe(0);
  });

  it("is proportional mid-stage", () => {
    expect(getGrowthProgress(150)).toBe(0.5); // (150-60)/(240-60)
    expect(getGrowthProgress(300)).toBeCloseTo((300 - 240) / 360, 10);
  });

  it("approaches 1 near the stage ceiling", () => {
    expect(getGrowthProgress(59)).toBeCloseTo(59 / 60, 10);
  });
});

describe("growth context windows", () => {
  it("counts only the current local day for today", () => {
    expect(
      getTodayFocusedMinutes([s(25), s(50, day(1))]),
    ).toBe(25);
  });

  it("covers the trailing 7 local days for the week", () => {
    expect(
      getWeeklyFocusedMinutes([
        s(30, day(3)),
        s(15, day(6)),
        s(100, day(8)),
      ]),
    ).toBe(45);
  });
});
