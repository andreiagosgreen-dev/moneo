// @vitest-environment node
import coreMigration from "../../../supabase/migrations/0001_core_schema.sql?raw";
import scopedMigration from "../../../supabase/migrations/0002_user_scoped_area_identity.sql?raw";
import scopedAssertions from "../../../supabase/tests/0002_area_identity.test.sql?raw";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SEEDED_AREA_CLOUD_IDS } from "../areaIdentity";
import { loadFocusAreas, markAreaDeleted, renameFocusArea, type FocusArea } from "../focusAreas";
import { DEFAULT_SETTINGS, loadHistory } from "../store";
import { getTotalFocusedMinutes } from "../growth";
import { STORAGE_KEYS as K } from "../storage/storageKeys";
import { planAreaMerge, remoteOnlyAreas, type RemoteAreaRow } from "./merge";
import { runSync } from "./syncEngine";
import { createLocalSyncIO, createSupabaseSyncRepos } from "./syncRepos";
import { pullAllSessions } from "../cloud/sessionRepository";
import { softDeleteArea } from "../cloud/areaRepository";

// Only the SDK transport is substituted. The real merge engine, local adapter,
// cloud repositories, row mapping, conflict targets and SQL/RLS execute below.
vi.mock("../supabase", () => ({ getSupabaseClient: async () => client }));

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";
const CUSTOM = "44444444-4444-4444-8444-444444444444";
const WORK = SEEDED_AREA_CLOUD_IDS["area:work"];
const STUDY = SEEDED_AREA_CLOUD_IDS["area:study"];
const migration = (name: string) => name === "0001_core_schema.sql" ? coreMigration : scopedMigration;
let db: PGlite;
let user = A;
let memory: Map<string, string>;
const writes: string[] = [];
const errors: string[] = [];
const ranges: number[] = [];
let failAreaPush = false;

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: unknown };

/** Supabase-shaped transport translating requests into actual PostgreSQL.
 * Restrict identifiers rather than accepting arbitrary SQL from test data.
 */
class Request implements PromiseLike<Result> {
  private filters: Array<[string, unknown]> = [];
  private ordering: string[] = [];
  private start?: number;
  private end?: number;
  private single = false;
  private rows?: Row[];
  private conflict?: string;
  private ignore = false;
  private patch?: Row;
  constructor(private table: string) {
    if (!["focus_areas", "focus_sessions", "user_settings"].includes(table)) throw Error(table);
  }
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
  order(key: string, opts: { ascending: boolean }) {
    this.ordering.push(`${this.ident(key)} ${opts.ascending ? "ASC" : "DESC"}`); return this;
  }
  range(from: number, to: number) { this.start = from; this.end = to; ranges.push(from); return this; }
  maybeSingle() { this.single = true; return this; }
  upsert(rows: Row | Row[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
    this.rows = Array.isArray(rows) ? rows : [rows]; this.conflict = opts.onConflict;
    this.ignore = opts.ignoreDuplicates === true; return this;
  }
  update(patch: Row) { this.patch = patch; return this; }
  private ident(name: string) {
    if (!/^[a-z_]+$/.test(name)) throw Error(`unsafe identifier: ${name}`);
    return `"${name}"`;
  }
  private async execute(): Promise<Result> {
    try {
      await db.exec("SET ROLE authenticated");
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
      if (this.rows) {
        writes.push(this.table);
        if (failAreaPush && this.table === "focus_areas") throw Error("simulated area upload failure");
        for (const row of this.rows) {
          const cols = Object.keys(row);
          const keys = this.conflict!.split(",");
          const action = this.ignore ? "DO NOTHING" : `DO UPDATE SET ${cols.filter(k => !keys.includes(k)).map(k => `${this.ident(k)}=EXCLUDED.${this.ident(k)}`).join(",")}`;
          await db.query(`INSERT INTO public.${this.table} (${cols.map(k => this.ident(k)).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT (${keys.map(k => this.ident(k)).join(",")}) ${action}`, Object.values(row));
        }
        return { data: null, error: null };
      }
      const values: unknown[] = [];
      const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
      const prefix = this.patch
        ? `UPDATE public.${this.table} SET ${Object.entries(this.patch).map(([k, v]) => `${this.ident(k)}=${param(v)}`).join(",")}`
        : `SELECT * FROM public.${this.table}`;
      const where = this.filters.length ? ` WHERE ${this.filters.map(([k, v]) => `${this.ident(k)}=${param(v)}`).join(" AND ")}` : "";
      const order = this.ordering.length ? ` ORDER BY ${this.ordering.join(",")}` : "";
      const range = this.start === undefined ? "" : ` LIMIT ${this.end! - this.start + 1} OFFSET ${this.start}`;
      const result = await db.query<Row>(prefix + where + order + range, values);
      // PostgREST returns JSON timestamp strings, not the driver's Date objects.
      const wireRows: Row[] = JSON.parse(JSON.stringify(result.rows));
      return { data: this.single ? wireRows[0] ?? null : wireRows, error: null };
    } catch (error) {
      errors.push(String(error));
      return { data: null, error };
    } finally {
      await db.exec("RESET ROLE");
    }
  }
  then<T = Result, U = never>(onfulfilled?: ((value: Result) => T | PromiseLike<T>) | null, onrejected?: ((reason: unknown) => U | PromiseLike<U>) | null): PromiseLike<T | U> {
    // Serialise requests because SET ROLE belongs to the single DB connection.
    const result = pending.then(() => this.execute());
    pending = result.then(() => undefined, () => undefined);
    return result.then(onfulfilled, onrejected);
  }
}
let pending: Promise<void> = Promise.resolve();
const client = { from: (table: string) => new Request(table) };

function device(areas?: FocusArea[]) {
  memory = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
  memory.set(K.schemaVersion, "3");
  memory.set(K.settings, JSON.stringify({ ...DEFAULT_SETTINGS, updatedAt: 100 }));
  if (areas) memory.set(K.focusAreas, JSON.stringify(areas));
  return loadFocusAreas();
}
const sync = () => runSync({ userId: user, consented: true, local: createLocalSyncIO(), repos: createSupabaseSyncRepos(), now: () => 1000 });
const remote = (a: FocusArea, changes: Partial<RemoteAreaRow> = {}): RemoteAreaRow => ({
  id: a.cloudId ?? a.id, name: a.name, createdAt: a.createdAt,
  updatedAt: a.updatedAt ?? a.createdAt, deletedAt: a.deletedAt ?? null, ...changes,
});
async function zeroOps() {
  writes.length = 0;
  for (let i = 0; i < 2; i++) {
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 0, appliedRemoteAreas: 0, insertedSessions: 0, adoptedSessions: 0, conflicts: 0, settingsOp: "noop" });
  }
  expect(writes).toEqual([]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`SET TIME ZONE 'UTC'; CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA auth, public TO authenticated;`);
  await db.exec(migration("0001_core_schema.sql"));
  await db.exec(migration("0002_user_scoped_area_identity.sql"));
  await db.exec("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated");
}, 30000);
beforeEach(async () => {
  await db.exec(`RESET ROLE; TRUNCATE auth.users CASCADE; INSERT INTO auth.users VALUES ('${A}'),('${B}');`);
  writes.length = 0; errors.length = 0; ranges.length = 0; failAreaPush = false; user = A;
  device();
});
afterAll(async () => { vi.unstubAllGlobals(); await db?.close(); });

describe("R4A cloud area identity", () => {
  it("Gate 0 exact reproduction: matching Work has no false insert or adoption", () => {
    const a = { id: "area:work", cloudId: WORK, name: "Work", createdAt: 5 };
    expect(planAreaMerge([a], [remote(a)])).toMatchObject({ pushInsertCount: 0, applyLocalCount: 0, noopCount: 1 });
    expect(remoteOnlyAreas([a], [remote(a)])).toEqual([]);
  });
  it.each(Object.keys(SEEDED_AREA_CLOUD_IDS))("matches seeded %s in cloud identity space", (id) => {
    const a = loadFocusAreas().find(a => a.id === id)!;
    expect(planAreaMerge([a], [remote(a)])).toMatchObject({ pushInsertCount: 0, noopCount: 1 });
    expect(remoteOnlyAreas([a], [remote(a)])).toEqual([]);
  });
  it.each([CUSTOM, "area-custom-fallback"])("pushes and converges custom local id %s without rewriting history", async (id) => {
    // Exercise the existing additive migration for both legacy local shapes.
    memory.set(K.schemaVersion, "2");
    memory.set(K.focusAreas, JSON.stringify([{ id, name: "Custom", createdAt: 5 }]));
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: id }]));
    const before = memory.get(K.history);
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 1, insertedSessions: 1 });
    const a = loadFocusAreas()[0];
    expect(a.id).toBe(id);
    expect(a.cloudId).toMatch(/^[0-9a-f-]{36}$/i);
    if (id === CUSTOM) expect(a.cloudId).toBe(id);
    expect((await db.query<{area_id: string}>("SELECT area_id FROM focus_sessions")).rows[0].area_id).toBe(a.cloudId);
    await zeroOps();
    expect(memory.get(K.history)).toBe(before);
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
  });
  it("same-user devices converge all seeds; a second user owns independent rows", async () => {
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: "area:work" }]));
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 3, insertedSessions: 1 });
    device(); // second independent device, same account
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 0, appliedRemoteAreas: 0, adoptedSessions: 1 });
    expect(loadHistory()).toEqual([{ id: S, at: 5000, min: 25, areaId: "area:work" }]);
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
    await zeroOps();
    user = B; device();
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 3 });
    expect(loadHistory()).toEqual([]);
    await zeroOps();
    const rows = (await db.query<{user_id: string; id: string}>("SELECT user_id,id FROM focus_areas")).rows;
    expect(rows).toHaveLength(6);
    expect(rows.filter(r => r.id === WORK).map(r => r.user_id).sort()).toEqual([A, B]);
    expect(errors).toEqual([]);
  });
  it("local-newer rename updates one cloud row and preserves both identities", async () => {
    await sync();
    const original = loadFocusAreas();
    const renamed = renameFocusArea(original, "area:work", "Job", Date.now() + 1000)!;
    memory.set(K.focusAreas, JSON.stringify(renamed));
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 1, appliedRemoteAreas: 0 });
    expect(loadFocusAreas()[0]).toMatchObject({ id: "area:work", cloudId: WORK, name: "Job" });
    expect((await db.query("SELECT name FROM focus_areas WHERE id=$1", [WORK])).rows).toEqual([{ name: "Job" }]);
    await zeroOps();
  });
  it("remote-newer rename applies to the local id without duplicate adoption", async () => {
    await sync();
    await db.query("UPDATE focus_areas SET name='Remote job',updated_at='2099-01-01' WHERE user_id=$1 AND id=$2", [A, WORK]);
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 0, appliedRemoteAreas: 1 });
    expect(loadFocusAreas()).toHaveLength(3);
    expect(loadFocusAreas()[0]).toMatchObject({ id: "area:work", cloudId: WORK, name: "Remote job" });
    await zeroOps();
  });
  it("local soft delete keeps identity and the historical session reference", async () => {
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: "area:work" }]));
    await sync();
    memory.set(K.focusAreas, JSON.stringify(markAreaDeleted(loadFocusAreas(), "area:work", Date.now() + 1000)));
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 1 });
    expect(loadFocusAreas()[0]).toMatchObject({ id: "area:work", cloudId: WORK });
    expect(loadFocusAreas()[0].deletedAt).toBeTypeOf("number");
    expect(loadHistory()[0].areaId).toBe("area:work");
    expect((await db.query("SELECT area_id FROM focus_sessions")).rows).toEqual([{ area_id: WORK }]);
    await zeroOps();
  });
  it("remote soft delete and later restoration converge without losing identity", async () => {
    await sync();
    await db.query("UPDATE focus_areas SET deleted_at='2098-01-01',updated_at='2098-01-01' WHERE user_id=$1 AND id=$2", [A, WORK]);
    expect(await sync()).toMatchObject({ ok: true, appliedRemoteAreas: 1 });
    expect(loadFocusAreas()[0].deletedAt).toBe(Date.parse("2098-01-01"));
    await zeroOps();
    await db.query("UPDATE focus_areas SET deleted_at=NULL,updated_at='2099-01-01' WHERE user_id=$1 AND id=$2", [A, WORK]);
    expect(await sync()).toMatchObject({ ok: true, appliedRemoteAreas: 1 });
    expect(loadFocusAreas()[0]).toMatchObject({ id: "area:work", cloudId: WORK });
    expect(loadFocusAreas()[0].deletedAt).toBeUndefined();
    await zeroOps();
  });
  it("adopts a remote-only custom area and maps its session locally", async () => {
    await db.query("INSERT INTO focus_areas(id,user_id,name) VALUES($1,$2,'Remote')", [CUSTOM, A]);
    await db.query("INSERT INTO focus_sessions(id,user_id,completed_at,duration_min,area_id) VALUES($1,$2,'2026-01-01',25,$3)", [S, A, CUSTOM]);
    expect(await sync()).toMatchObject({ ok: true, appliedRemoteAreas: 1, adoptedSessions: 1 });
    expect(loadFocusAreas().find(a => a.id === CUSTOM)).toMatchObject({ cloudId: CUSTOM, name: "Remote" });
    expect(loadHistory()[0].areaId).toBe(CUSTOM);
    await zeroOps();
  });
  it("uploads seeded areas before their sessions through the production repositories", async () => {
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: "area:work" }]));
    const before = memory.get(K.history);
    expect(await sync()).toMatchObject({ ok: true, pushedAreas: 3, insertedSessions: 1 });
    expect(writes.indexOf("focus_areas")).toBeLessThan(writes.indexOf("focus_sessions"));
    expect(errors).toEqual([]);
    expect((await db.query("SELECT user_id,area_id FROM focus_sessions")).rows).toEqual([{ user_id: A, area_id: WORK }]);
    await zeroOps();
    expect(memory.get(K.history)).toBe(before);
  });
  it("failed area upload prevents dependent sessions and retries safely", async () => {
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: "area:work" }]));
    failAreaPush = true;
    expect(await sync()).toMatchObject({ ok: false, stage: "push" });
    expect(writes).toEqual(["focus_areas"]);
    expect(loadHistory()[0].areaId).toBe("area:work");
    failAreaPush = false;
    expect(await sync()).toMatchObject({ ok: true, insertedSessions: 1 });
    await zeroOps();
  });
  it("R2 area conflict adopts remote canonical Study then second and third sync are zero-op", async () => {
    memory.set(K.history, JSON.stringify([{ id: S, at: 5000, min: 25, areaId: "area:work" }]));
    await sync();
    await db.query("UPDATE focus_sessions SET area_id=$1 WHERE id=$2", [STUDY, S]);
    expect(await sync()).toMatchObject({ ok: true, conflicts: 1, adoptedSessions: 0 });
    expect(loadHistory()).toEqual([{ id: S, at: 5000, min: 25, areaId: "area:study" }]);
    expect(getTotalFocusedMinutes(loadHistory())).toBe(25);
    await zeroOps();
  });
  it("R3 actual paginated repository maps a later-page seeded session to its local id", async () => {
    await sync();
    await db.query("INSERT INTO focus_sessions(id,user_id,completed_at,duration_min,area_id) VALUES($1,$2,'2026-01-01',10,NULL),($3,$2,'2026-01-02',25,$4)", [CUSTOM, A, S, WORK]);
    const repos = createSupabaseSyncRepos();
    repos.pullSessions = id => pullAllSessions(id, 1);
    expect(await runSync({ userId: A, consented: true, local: createLocalSyncIO(), repos })).toMatchObject({ ok: true, adoptedSessions: 2, appliedRemoteAreas: 0 });
    expect(ranges).toContain(2); // final empty probe after two full pages
    expect(loadHistory().find(s => s.id === S)?.areaId).toBe("area:work");
    expect(getTotalFocusedMinutes(loadHistory())).toBe(35);
    await zeroOps();
  });
  it("repository soft delete scopes the composite key to the requested owner", async () => {
    await sync(); user = B; device(); await sync(); user = A;
    expect(await softDeleteArea(A, WORK)).toBe(true);
    expect((await db.query("SELECT deleted_at=updated_at AS stamped FROM focus_areas WHERE user_id=$1 AND id=$2", [A, WORK])).rows).toEqual([{stamped:true}]);
    const rows = (await db.query<{user_id: string; deleted: boolean}>("SELECT user_id,deleted_at IS NOT NULL AS deleted FROM focus_areas WHERE id=$1 ORDER BY user_id", [WORK])).rows;
    expect(rows).toEqual([{user_id:A,deleted:true},{user_id:B,deleted:false}]);
  });
  it("executes scoped PK, FK, delete and RLS SQL assertions", async () => {
    await db.exec(scopedAssertions);
  });
  it("additive migration preserves existing rows and rolls back invalid cross-owner history", async () => {
    const legacy = new PGlite();
    try {
      await legacy.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`);
      await legacy.exec(migration("0001_core_schema.sql"));
      await legacy.exec(`INSERT INTO auth.users VALUES ('${A}'),('${B}');
        INSERT INTO focus_areas(id,user_id,name) VALUES ('${WORK}','${A}','Work');
        INSERT INTO focus_sessions(id,user_id,completed_at,duration_min,area_id)
        VALUES ('${S}','${A}','2026-01-01',25,'${WORK}');`);
      const before = (await legacy.query("SELECT * FROM focus_sessions")).rows;
      const areasBefore = (await legacy.query("SELECT * FROM focus_areas")).rows;
      // 0001 permits a foreign-owner association: 0002 must refuse, not rewrite it.
      await legacy.exec(`INSERT INTO focus_sessions(id,user_id,completed_at,duration_min,area_id)
        VALUES ('${CUSTOM}','${B}','2026-01-01',10,'${WORK}');`);
      await expect(legacy.exec(migration("0002_user_scoped_area_identity.sql"))).rejects.toMatchObject({ code: "23503" });
      await legacy.exec("ROLLBACK");
      expect((await legacy.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='focus_areas_pkey'")).rows).toEqual([{def:"PRIMARY KEY (id)"}]);
      expect((await legacy.query("SELECT count(*)::int AS n FROM focus_sessions")).rows).toEqual([{n:2}]);
      // Explicit fixture repair only; the migration never changes stored data.
      await legacy.query("DELETE FROM focus_sessions WHERE id=$1", [CUSTOM]);
      await legacy.exec(migration("0002_user_scoped_area_identity.sql"));
      expect((await legacy.query("SELECT * FROM focus_sessions")).rows).toEqual(before);
      expect((await legacy.query("SELECT * FROM focus_areas")).rows).toEqual(areasBefore);
      expect((await legacy.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='focus_areas_pkey'")).rows).toEqual([{def:"PRIMARY KEY (user_id, id)"}]);
    } finally { await legacy.close(); }
  }, 30000);
});
