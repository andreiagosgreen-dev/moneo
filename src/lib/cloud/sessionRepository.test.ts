import { describe, expect, it } from 'vitest';
import {
  SESSION_PULL_PAGE_SIZE,
  mapCloudSessionRow,
  pullPaged,
  type CloudSessionRow,
} from './sessionRepository';

/* ---------- deterministic paged-dataset harness ---------- */

/** Builds a fake page source over `total` rows with the given page size.
 *  Records every requested range; can fail a specific page index. */
function pagedSource(opts: { total: number; pageSize: number; failPageIndex?: number }) {
  const ranges: Array<{ from: number; to: number }> = [];
  let calls = 0;
  const fetchPage = async (from: number, to: number): Promise<number[] | null> => {
    const pageIndex = calls++;
    ranges.push({ from, to });
    if (opts.failPageIndex === pageIndex) return null;
    const slice: number[] = [];
    for (let i = from; i <= to && i < opts.total; i++) slice.push(i);
    return slice;
  };
  return { fetchPage, ranges: () => ranges, calls: () => calls };
}

describe('pullPaged — boundary matrix', () => {
  it('0 rows → one request, empty result', async () => {
    const src = pagedSource({ total: 0, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([]);
    expect(src.calls()).toBe(1);
  });

  it('1 row → one request', async () => {
    const src = pagedSource({ total: 1, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([0]);
    expect(src.calls()).toBe(1);
  });

  it('PAGE_SIZE − 1 rows → one request, no second probe', async () => {
    const src = pagedSource({ total: 3, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([0, 1, 2]);
    expect(src.calls()).toBe(1);
  });

  it('exactly PAGE_SIZE rows → second request proves completion', async () => {
    const src = pagedSource({ total: 4, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([0, 1, 2, 3]);
    expect(src.calls()).toBe(2); // page 2 returns 0 rows → stop
  });

  it('PAGE_SIZE + 1 rows → two requests', async () => {
    const src = pagedSource({ total: 5, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([0, 1, 2, 3, 4]);
    expect(src.calls()).toBe(2);
  });

  it('exactly two full pages → third request establishes completion', async () => {
    const src = pagedSource({ total: 8, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(src.calls()).toBe(3);
  });

  it('two pages + 1 → three requests, no row loss', async () => {
    const src = pagedSource({ total: 9, pageSize: 4 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toHaveLength(9);
    expect(res).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(src.calls()).toBe(3);
  });

  it('requests deterministic inclusive ranges starting at 0', async () => {
    const src = pagedSource({ total: 9, pageSize: 4 });
    await pullPaged(src.fetchPage, 4);
    expect(src.ranges()).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 8, to: 11 },
    ]);
  });
});

describe('pullPaged — the historical 20k cap is gone', () => {
  it('20,001 rows with the PRODUCTION page size complete fully (21 requests)', async () => {
    expect(SESSION_PULL_PAGE_SIZE).toBe(1000);
    const src = pagedSource({ total: 20_001, pageSize: SESSION_PULL_PAGE_SIZE });
    const res = await pullPaged(src.fetchPage, SESSION_PULL_PAGE_SIZE);
    expect(res).not.toBeNull();
    expect(res).toHaveLength(20_001); // nothing truncated at 20,000
    expect(res![0]).toBe(0);
    expect(res![20_000]).toBe(20_000);
    expect(src.calls()).toBe(21); // 20 full pages + 1-row page
    // no duplicates, no gaps
    expect(new Set(res).size).toBe(20_001);
  });

  it('a pathological never-terminating source fails instead of looping forever', async () => {
    let calls = 0;
    const infinite = async () => {
      calls++;
      return [1, 2, 3, 4]; // always exactly pageSize
    };
    const res = await pullPaged(infinite, 4, 50);
    expect(res).toBeNull();
    expect(calls).toBe(50);
  });
});

describe('pullPaged — failure and retry semantics', () => {
  it('a later-page failure returns null — NEVER a partial history', async () => {
    const src = pagedSource({ total: 12, pageSize: 4, failPageIndex: 2 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toBeNull(); // pages 0-1 succeeded (8 rows) but are discarded
    expect(src.calls()).toBe(3);
  });

  it('page 1 failing immediately also returns null', async () => {
    const src = pagedSource({ total: 12, pageSize: 4, failPageIndex: 0 });
    const res = await pullPaged(src.fetchPage, 4);
    expect(res).toBeNull();
    expect(src.calls()).toBe(1);
  });

  it('retry after a failed attempt obtains the FULL history with no duplicates', async () => {
    const failing = pagedSource({ total: 12, pageSize: 4, failPageIndex: 1 });
    expect(await pullPaged(failing.fetchPage, 4)).toBeNull();
    // Second attempt, fresh source, all pages succeed.
    const healthy = pagedSource({ total: 12, pageSize: 4 });
    const res = await pullPaged(healthy.fetchPage, 4);
    expect(res).toHaveLength(12);
    expect(new Set(res).size).toBe(12);
    expect(res).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('mapCloudSessionRow — per-page normalization', () => {
  const row = (over: Partial<CloudSessionRow> = {}): CloudSessionRow => ({
    id: 's1',
    user_id: 'u1',
    completed_at: '2026-09-04T10:00:00.000Z',
    duration_min: 25,
    intention: null,
    area_id: null,
    ...over,
  });

  it('normalizes ISO timestamptz to epoch-ms so equivalent instants compare equal', () => {
    const mapped = mapCloudSessionRow(row());
    expect(mapped.at).toBe(Date.UTC(2026, 8, 4, 10, 0, 0, 0));
    expect(mapped.at).toBe(Date.parse('2026-09-04T10:00:00.000Z'));
  });

  it('preserves id, duration and passes optional fields through unchanged', () => {
    const mapped = mapCloudSessionRow(
      row({ id: 'x', duration_min: 50, intention: 'Thesis', area_id: null }),
    );
    expect(mapped).toEqual({ id: 'x', at: mapped.at, min: 50, intention: 'Thesis', areaId: null });
  });

  it('preserves a cloud Focus Area UUID untouched (R1 semantics)', () => {
    const uuid = 'a1100000-0000-4000-8000-000000000001';
    const mapped = mapCloudSessionRow(row({ area_id: uuid }));
    expect(mapped.areaId).toBe(uuid);
  });
});
