import { describe, expect, it } from "vitest";
import { dayKey } from "./store";
import {
  currentStreakInTz,
  dayKeyInTz,
  getBrowserTimezone,
  getEffectiveTimezone,
  isTodayInTz,
  isValidIanaTimezone,
  minutesForDayKey,
  trailingWeekDayKeysInTz,
} from "./timezone";

describe("timezone policy seam", () => {
  it("resolves a valid IANA browser timezone", () => {
    expect(isValidIanaTimezone(getBrowserTimezone())).toBe(true);
  });

  it("accepts real IANA zones and rejects impostors", () => {
    expect(isValidIanaTimezone("Europe/Chisinau")).toBe(true);
    expect(isValidIanaTimezone("America/New_York")).toBe(true);
    expect(isValidIanaTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidIanaTimezone("Not/AZone")).toBe(false);
    expect(isValidIanaTimezone("")).toBe(false);
    expect(isValidIanaTimezone(42)).toBe(false);
  });

  it("prefers a valid account timezone, falls back to the browser", () => {
    expect(getEffectiveTimezone("Europe/London")).toBe("Europe/London");
    expect(getEffectiveTimezone("Mars/Olympus")).toBe(getBrowserTimezone());
    expect(getEffectiveTimezone(null)).toBe(getBrowserTimezone());
    expect(getEffectiveTimezone(undefined)).toBe(getBrowserTimezone());
  });
});

describe("timezone-aware day helpers", () => {
  // 2026-01-15 23:30 UTC — still the 15th in UTC, already the 16th in Tokyo (+9).
  const ts = Date.UTC(2026, 0, 15, 23, 30, 0);

  it("computes the calendar day per timezone", () => {
    expect(dayKeyInTz(ts, "UTC")).toBe("2026-1-15");
    expect(dayKeyInTz(ts, "Asia/Tokyo")).toBe("2026-1-16");
  });

  it("falls back to UTC for an invalid zone rather than throwing", () => {
    expect(() => dayKeyInTz(ts, "Not/AZone")).not.toThrow();
    expect(dayKeyInTz(ts, "Not/AZone")).toBe(dayKeyInTz(ts, "UTC"));
  });

  it("isTodayInTz agrees with the zone's own midnight boundary", () => {
    const now = Date.now();
    expect(isTodayInTz(now, "UTC")).toBe(true);
    expect(isTodayInTz(now - 400 * 24 * 3600_000, "UTC")).toBe(false);
  });

  it("produces n unique trailing day keys ending today-in-zone", () => {
    const keys = trailingWeekDayKeysInTz(7, "UTC");
    expect(keys).toHaveLength(7);
    expect(new Set(keys).size).toBe(7);
    expect(keys[keys.length - 1]).toBe(dayKeyInTz(Date.now(), "UTC"));
  });
});

describe("account-timezone day grouping (Gate 9)", () => {
  it("browser-timezone grouping matches the legacy local-day grouping", () => {
    // Anonymous users keep EXACTLY the previous behavior: tz-aware keys in
    // the browser zone must equal the device-local dayKey for any instant.
    const tz = getBrowserTimezone();
    const samples = [
      Date.UTC(2026, 0, 15, 23, 59, 59),
      Date.UTC(2026, 5, 30, 12, 0, 0),
      Date.now(),
      Date.now() - 3 * 24 * 3600_000,
    ];
    for (const ts of samples) {
      expect(dayKeyInTz(ts, tz)).toBe(dayKey(new Date(ts)));
    }
  });

  it("respects the midnight boundary in America/New_York", () => {
    // 2026-03-10 04:30 UTC == 00:30 EDT (the 10th) vs 03:30 UTC == 23:30 EST (the 9th).
    expect(dayKeyInTz(Date.UTC(2026, 2, 10, 4, 30), "America/New_York")).toBe("2026-3-10");
    expect(dayKeyInTz(Date.UTC(2026, 2, 10, 3, 30), "America/New_York")).toBe("2026-3-9");
  });

  it("respects the midnight boundary in Europe/Chisinau and Asia/Tokyo", () => {
    // Chisinau is UTC+2 in winter: 22:30 UTC is already the next local day.
    expect(dayKeyInTz(Date.UTC(2026, 0, 15, 22, 30), "Europe/Chisinau")).toBe("2026-1-16");
    expect(dayKeyInTz(Date.UTC(2026, 0, 15, 21, 30), "Europe/Chisinau")).toBe("2026-1-15");
    // Tokyo UTC+9.
    expect(dayKeyInTz(Date.UTC(2026, 0, 15, 15, 30), "Asia/Tokyo")).toBe("2026-1-16");
  });

  it("trailing week keys stay unique across a DST transition", () => {
    // US DST spring-forward 2026-03-08: a naive -7d walk can skip a day.
    const keys = trailingWeekDayKeysInTz(7, "America/New_York");
    expect(keys).toHaveLength(7);
    expect(new Set(keys).size).toBe(7);
  });

  it("sums minutes per account-timezone day", () => {
    const hist = [
      { at: Date.UTC(2026, 0, 15, 22, 30), min: 25 }, // the 16th in Chisinau
      { at: Date.UTC(2026, 0, 15, 10, 0), min: 50 }, // the 15th in Chisinau
    ];
    expect(minutesForDayKey(hist, "2026-1-16", "Europe/Chisinau")).toBe(25);
    expect(minutesForDayKey(hist, "2026-1-15", "Europe/Chisinau")).toBe(50);
  });

  it("computes streaks in the account timezone", () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      d.setHours(12, 0, 0, 0);
      return d.getTime();
    };
    const hist = [{ at: day(0) }, { at: day(1) }, { at: day(3) }];
    expect(currentStreakInTz(hist, "UTC")).toBe(2);
    expect(currentStreakInTz([], "UTC")).toBe(0);
  });
});
