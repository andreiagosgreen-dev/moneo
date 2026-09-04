import { describe, expect, it } from "vitest";
import type { FocusArea } from "../focusAreas";
import {
  planAreaMerge,
  planSessionMerge,
  planSettingsMerge,
  remoteOnlyAreas,
  sessionPayloadEqual,
  type RemoteAreaRow,
  type RemoteSessionRow,
  type RemoteSettingsRow,
} from "./merge";

const rs = (id: string, over: Partial<RemoteSessionRow> = {}): RemoteSessionRow => ({
  id,
  at: 1000,
  min: 25,
  intention: null,
  areaId: null,
  ...over,
});

const area = (id: string, over: Partial<FocusArea> = {}): FocusArea => ({
  id,
  name: "Area",
  createdAt: 100,
  ...over,
});

const rArea = (id: string, over: Partial<RemoteAreaRow> = {}): RemoteAreaRow => ({
  id,
  name: "Area",
  createdAt: 100,
  updatedAt: 100,
  deletedAt: null,
  ...over,
});

describe("session merge plans", () => {
  it("local-only sessions are queued for remote insert", () => {
    const plan = planSessionMerge(
      [{ id: "s1", at: 1000, min: 25 }],
      [],
    );
    expect(plan.insertRemote).toHaveLength(1);
    expect(plan.insertRemote[0].id).toBe("s1");
    expect(plan.adoptLocal).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("remote-only sessions are adopted locally", () => {
    const plan = planSessionMerge([], [rs("r1"), rs("r2")]);
    expect(plan.adoptLocal.map((s) => s.id)).toEqual(["r1", "r2"]);
    expect(plan.insertRemote).toHaveLength(0);
  });

  it("identical payloads are a noop", () => {
    const local = [{ id: "s1", at: 1000, min: 25 }];
    const plan = planSessionMerge(local, [rs("s1")]);
    expect(plan.noopCount).toBe(1);
    expect(plan.insertRemote).toHaveLength(0);
    expect(plan.adoptLocal).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("same id with different immutable payload is a conflict (remote canonical)", () => {
    const local = [{ id: "s1", at: 1000, min: 25, intention: "Local note" }];
    const plan = planSessionMerge(local, [rs("s1", { intention: "Cloud note" })]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].remote.intention).toBe("Cloud note");
    // Local is preserved as-is; nothing is pushed or duplicated.
    expect(plan.insertRemote).toHaveLength(0);
    expect(plan.adoptLocal).toHaveLength(0);
  });

  it("normalizes absent intention/areaId against null for equality", () => {
    expect(
      sessionPayloadEqual({ id: "x", at: 5, min: 9 }, rs("x", { at: 5, min: 9 })),
    ).toBe(true);
    expect(
      sessionPayloadEqual(
        { id: "x", at: 5, min: 9, intention: "A" },
        rs("x", { at: 5, min: 9 }),
      ),
    ).toBe(false);
  });

  it("skips local sessions without an id (pre-backfill guard)", () => {
    const plan = planSessionMerge([{ at: 1, min: 2 }], []);
    expect(plan.insertRemote).toHaveLength(0);
  });

  it("handles mixed plans without duplicating ids", () => {
    const plan = planSessionMerge(
      [
        { id: "same", at: 1, min: 1 },
        { id: "only-local", at: 2, min: 2 },
      ],
      [rs("same", { at: 1, min: 1 }), rs("only-remote", { at: 3, min: 3 })],
    );
    expect(plan.noopCount).toBe(1);
    expect(plan.insertRemote.map((s) => s.id)).toEqual(["only-local"]);
    expect(plan.adoptLocal.map((s) => s.id)).toEqual(["only-remote"]);
    const allIds = [
      ...plan.insertRemote.map((s) => s.id),
      ...plan.adoptLocal.map((s) => s.id),
    ];
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("area merge plans", () => {
  it("local-only areas are pushed as inserts", () => {
    const plan = planAreaMerge([area("a1")], []);
    expect(plan.pushInsertCount).toBe(1);
    expect(plan.ops[0].op.kind).toBe("pushInsert");
  });

  it("local-newer changed areas are pushed as updates", () => {
    const plan = planAreaMerge(
      [area("a1", { name: "Renamed", updatedAt: 300 })],
      [rArea("a1", { updatedAt: 200 })],
    );
    expect(plan.pushUpdateCount).toBe(1);
  });

  it("remote-newer changed areas are applied locally", () => {
    const plan = planAreaMerge(
      [area("a1", { updatedAt: 100 })],
      [rArea("a1", { name: "Cloud name", updatedAt: 200 })],
    );
    expect(plan.applyLocalCount).toBe(1);
  });

  it("remote soft-deletion newer than local marks the area deleted", () => {
    const plan = planAreaMerge(
      [area("a1", { updatedAt: 100 })],
      [rArea("a1", { updatedAt: 200, deletedAt: 200 })],
    );
    expect(plan.applyLocalCount).toBe(1);
    const op = plan.ops[0].op;
    expect(op.kind).toBe("applyLocal");
    if (op.kind === "applyLocal") expect(op.remote.deletedAt).toBe(200);
  });

  it("unchanged areas are noops regardless of stamp order", () => {
    const same = planAreaMerge(
      [area("a1", { updatedAt: 300 })],
      [rArea("a1", { updatedAt: 200 })],
    );
    expect(same.noopCount).toBe(1);
    const same2 = planAreaMerge(
      [area("a1", { updatedAt: 100 })],
      [rArea("a1", { updatedAt: 200 })],
    );
    expect(same2.noopCount).toBe(1);
  });

  it("exact timestamp tie is remote-canonical: differing adopts, identical noops", () => {
    const differing = planAreaMerge(
      [area("a1", { updatedAt: 200 })],
      [rArea("a1", { name: "Cloud", updatedAt: 200 })],
    );
    expect(differing.applyLocalCount).toBe(1);
    const identical = planAreaMerge(
      [area("a1", { updatedAt: 200 })],
      [rArea("a1", { updatedAt: 200 })],
    );
    expect(identical.noopCount).toBe(1);
    expect(identical.applyLocalCount).toBe(0);
  });

  it("remoteOnlyAreas lists only ids absent locally", () => {
    const rows = remoteOnlyAreas(
      [area("a1")],
      [rArea("a1"), rArea("a2")],
    );
    expect(rows.map((r) => r.id)).toEqual(["a2"]);
  });
});

describe("settings merge plans", () => {
  const base = {
    focusMin: 25,
    shortMin: 5,
    longMin: 15,
    longEvery: 4,
    dailyGoal: 8,
    autoStart: false,
    sound: true,
  };
  const remote = (over: Partial<RemoteSettingsRow> = {}): RemoteSettingsRow => ({
    ...base,
    updatedAt: 500,
    ...over,
  });

  it("no remote row → pushLocal", () => {
    expect(planSettingsMerge({ ...base, updatedAt: 100 }, null)).toBe("pushLocal");
  });

  it("local newer → pushLocal", () => {
    expect(planSettingsMerge({ ...base, updatedAt: 600 }, remote())).toBe("pushLocal");
  });

  it("remote newer → applyRemote", () => {
    expect(planSettingsMerge({ ...base, updatedAt: 400 }, remote())).toBe("applyRemote");
  });

  it("equal timestamps → noop (local canonical)", () => {
    expect(planSettingsMerge({ ...base, updatedAt: 500 }, remote())).toBe("noop");
  });

  it("missing local stamp behaves as oldest", () => {
    expect(planSettingsMerge({ ...base }, remote())).toBe("applyRemote");
  });
});
