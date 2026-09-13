import { describe, expect, it } from "vitest";
import type { Settings } from "./store";
import {
  applyCompletion,
  applySkip,
  endsAtFor,
  remainingAt,
  shouldPersist,
} from "./timerEngine";

const baseSettings: Settings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4,
  dailyGoal: 8,
  autoStart: false,
  sound: true,
      soundType: "bell" as const,
      volume: 50,
      notifications: true,
};

describe("focus completion", () => {
  it("credits one session and moves to a short break", () => {
    const at = 1_700_000_000_000;
    const res = applyCompletion("focus", 0, baseSettings, at, 25);
    expect(res.mode).toBe("short");
    expect(res.cycle).toBe(1);
    expect(res.session).toEqual({ at, min: 25 });
  });

  it("credits the duration of the round that actually ran, not the current setting (Gate 2 regression)", () => {
    // A 25-minute round was started; the user changed Focus length to 40
    // before the running round finished. The entry must credit 25.
    const res = applyCompletion(
      "focus",
      0,
      { ...baseSettings, focusMin: 40 },
      1_700_000_000_000,
      25,
    );
    expect(res.session?.min).toBe(25);
  });

  it("stamps the scheduled completion time, not the detection time (Gate 2 regression)", () => {
    // The round was scheduled to end at `scheduled`; a suspended browser
    // could detect it minutes later. `at` must pass through unchanged.
    const scheduled = 1_700_000_000_000;
    const res = applyCompletion("focus", 0, baseSettings, scheduled, 25);
    expect(res.session?.at).toBe(scheduled);
  });
});

describe("break transitions", () => {
  it("moves to a long break when the cycle is full", () => {
    const res = applyCompletion("focus", 3, baseSettings, 5, 25);
    expect(res.mode).toBe("long");
    expect(res.cycle).toBe(0); // cycle resets once the long break is scheduled
    expect(res.session).not.toBeNull();
  });

  it("respects custom long-break intervals", () => {
    const res = applyCompletion(
      "focus",
      1,
      { ...baseSettings, longEvery: 2 },
      5,
      25,
    );
    expect(res.mode).toBe("long");
    expect(res.cycle).toBe(0);
  });

  it("returns to focus after any break without crediting a session", () => {
    for (const mode of ["short", "long"] as const) {
      const res = applyCompletion(mode, 2, baseSettings, 9, 25);
      expect(res.mode).toBe("focus");
      expect(res.cycle).toBe(2);
      expect(res.session).toBeNull();
    }
  });
});

describe("skip and reset credit nothing", () => {
  it("skip changes mode but produces no session", () => {
    expect(applySkip("focus")).toBe("short");
    expect(applySkip("short")).toBe("focus");
    expect(applySkip("long")).toBe("focus");
  });

  it("only natural focus completion can produce a session", () => {
    expect(applyCompletion("short", 1, baseSettings, 1, 25).session).toBeNull();
    expect(applyCompletion("long", 1, baseSettings, 1, 25).session).toBeNull();
  });
});

describe("pause/resume timing", () => {
  it("pause preserves elapsed time and resume keeps the schedule exact", () => {
    const t0 = 1_000_000;
    const endsAt = endsAtFor(1500, t0); // a 25:00 round

    // Ten minutes in, pause: 15:00 must remain.
    expect(remainingAt(endsAt, t0 + 600_000)).toBe(900);

    // Resume five minutes later; the round must end exactly 15:00 after resume.
    const resumeAt = t0 + 900_000;
    const endsAt2 = endsAtFor(900, resumeAt);
    expect(remainingAt(endsAt2, resumeAt + 899_500)).toBe(1);
    expect(remainingAt(endsAt2, resumeAt + 900_000)).toBe(0);
  });

  it("never reports negative remaining after an overshoot (tab sleep)", () => {
    const endsAt = endsAtFor(60, 0);
    expect(remainingAt(endsAt, 120_000)).toBe(0);
  });
});

describe("snapshot persistence gate", () => {
  const sig = "focus|1500|0";

  it("always persists when paused or idle", () => {
    expect(shouldPersist(sig, sig, false, 1_000, 0, 10_000)).toBe(true);
    expect(shouldPersist(sig, sig, false, 1_500, 1_499, 10_000)).toBe(true);
  });

  it("throttles countdown ticks while running", () => {
    expect(shouldPersist(sig, sig, true, 10_000, 0, 10_000)).toBe(true); // first write
    expect(shouldPersist(sig, sig, true, 16_000, 10_000, 10_000)).toBe(false);
    expect(shouldPersist(sig, sig, true, 21_000, 10_000, 10_000)).toBe(true);
  });

  it("persists immediately on discrete state changes (mode/total/cycle)", () => {
    expect(
      shouldPersist("focus|1500|0", "short|300|1", true, 10_200, 10_000, 10_000),
    ).toBe(true);
  });
});
