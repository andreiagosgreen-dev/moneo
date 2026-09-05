// @vitest-environment node
import coreMigration from "../../../supabase/migrations/0001_core_schema.sql?raw";
import scopedMigration from "../../../supabase/migrations/0002_user_scoped_area_identity.sql?raw";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const WORK = "a1100000-0000-4000-8000-000000000001";
const A_ONLY = "a1100000-0000-4000-8000-000000000099";
let db: PGlite;

async function asUser<T = Record<string, unknown>>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("SET ROLE authenticated");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("RESET ROLE");
  }
}

const settings = (userId: string) => [userId, 25, 5, 15, 4, 8, false, true];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA auth, public TO authenticated;`);
  await db.exec(coreMigration);
  await db.exec(scopedMigration);
  await db.exec("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated");
  await db.query("INSERT INTO auth.users(id) VALUES ($1), ($2)", [A, B]);
}, 30000);

afterAll(async () => { await db.close(); });

describe("R4C final migration chain and RLS matrix", () => {
  it("applies 0001 then 0002 with the scoped PK, FK, index, and enabled RLS", async () => {
    expect((await db.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='focus_areas_pkey'")).rows)
      .toEqual([{ def: "PRIMARY KEY (user_id, id)" }]);
    expect((await db.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='focus_sessions_user_area_fkey'")).rows)
      .toEqual([{ def: "FOREIGN KEY (user_id, area_id) REFERENCES focus_areas(user_id, id) ON DELETE SET NULL (area_id)" }]);
    expect((await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname='focus_sessions_user_area_idx'")).rows)
      .toEqual([{ indexname: "focus_sessions_user_area_idx" }]);
    expect((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE relrowsecurity AND oid IN ('public.profiles'::regclass,'public.focus_areas'::regclass,'public.focus_sessions'::regclass,'public.user_settings'::regclass)")).rows)
      .toEqual([{ n: 4 }]);
  });

  it("enforces complete owner-only CRUD and FK behavior for both authenticated users", async () => {
    await asUser(A, "INSERT INTO public.profiles(user_id,timezone) VALUES($1,'UTC')", [A]);
    await asUser(A, "INSERT INTO public.user_settings(user_id,focus_min,short_min,long_min,long_every,daily_goal,auto_start,sound) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", settings(A));
    await asUser(A, "INSERT INTO public.focus_areas(user_id,id,name) VALUES($1,$2,'A Work'),($1,$3,'A only')", [A, WORK, A_ONLY]);
    await asUser(A, "INSERT INTO public.focus_sessions(id,user_id,completed_at,duration_min,area_id) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$1,now(),25,$2)", [A, WORK]);

    // A can read and update each owned row; sessions and areas also permit delete.
    for (const table of ["profiles", "user_settings", "focus_areas", "focus_sessions"]) {
      expect((await asUser(A, `SELECT * FROM public.${table}`)).rows.length).toBeGreaterThan(0);
    }
    expect((await asUser(A, "UPDATE public.profiles SET timezone='Europe/Chisinau' WHERE user_id=$1 RETURNING *", [A])).rows).toHaveLength(1);
    expect((await asUser(A, "UPDATE public.user_settings SET focus_min=30 WHERE user_id=$1 RETURNING *", [A])).rows).toHaveLength(1);
    expect((await asUser(A, "UPDATE public.focus_areas SET name='A renamed' WHERE user_id=$1 AND id=$2 RETURNING *", [A, WORK])).rows).toHaveLength(1);
    expect((await asUser(A, "UPDATE public.focus_sessions SET duration_min=30 WHERE user_id=$1 RETURNING *", [A])).rows).toHaveLength(1);

    // B can create, read, update and delete B-owned rows, including the same seed UUID.
    await asUser(B, "INSERT INTO public.profiles(user_id,timezone) VALUES($1,'UTC')", [B]);
    await asUser(B, "INSERT INTO public.user_settings(user_id,focus_min,short_min,long_min,long_every,daily_goal,auto_start,sound) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", settings(B));
    await asUser(B, "INSERT INTO public.focus_areas(user_id,id,name) VALUES($1,$2,'B Work'),($1,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B disposable')", [B, WORK]);
    await asUser(B, "INSERT INTO public.focus_sessions(id,user_id,completed_at,duration_min,area_id) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$1,now(),25,$2)", [B, WORK]);
    expect((await asUser(B, "UPDATE public.profiles SET timezone='Europe/Paris' WHERE user_id=$1 RETURNING *", [B])).rows).toHaveLength(1);
    expect((await asUser(B, "UPDATE public.user_settings SET focus_min=35 WHERE user_id=$1 RETURNING *", [B])).rows).toHaveLength(1);
    expect((await asUser(B, "UPDATE public.focus_areas SET name='B renamed' WHERE user_id=$1 AND id=$2 RETURNING *", [B, WORK])).rows).toHaveLength(1);
    expect((await asUser(B, "UPDATE public.focus_sessions SET duration_min=35 WHERE user_id=$1 RETURNING *", [B])).rows).toHaveLength(1);
    expect((await asUser(B, "DELETE FROM public.focus_sessions WHERE user_id=$1 RETURNING *", [B])).rows).toHaveLength(1);
    expect((await asUser(B, "DELETE FROM public.focus_areas WHERE user_id=$1 AND id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' RETURNING *", [B])).rows).toHaveLength(1);

    // B cannot see, alter, remove, or insert valid rows owned by A.
    for (const table of ["profiles", "user_settings", "focus_areas", "focus_sessions"]) {
      expect((await asUser(B, `SELECT * FROM public.${table} WHERE user_id=$1`, [A])).rows).toEqual([]);
      expect((await asUser(B, `UPDATE public.${table} SET user_id=$1 WHERE user_id=$2 RETURNING *`, [B, A])).rows).toEqual([]);
      expect((await asUser(B, `DELETE FROM public.${table} WHERE user_id=$1 RETURNING *`, [A])).rows).toEqual([]);
    }
    await expect(asUser(B, "INSERT INTO public.profiles(user_id,timezone) VALUES($1,'UTC')", [A])).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(B, "INSERT INTO public.user_settings(user_id,focus_min,short_min,long_min,long_every,daily_goal,auto_start,sound) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", settings(A))).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(B, "INSERT INTO public.focus_areas(user_id,id,name) VALUES($1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','spoof')", [A])).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(B, "INSERT INTO public.focus_sessions(id,user_id,completed_at,duration_min) VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc',$1,now(),25)", [A])).rejects.toMatchObject({ code: "42501" });

    // An owner cannot transfer its own data, and B cannot attach to A-only area.
    await expect(asUser(A, "UPDATE public.focus_areas SET user_id=$1 WHERE id=$2 RETURNING *", [B, WORK])).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(A, "UPDATE public.focus_sessions SET user_id=$1 WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' RETURNING *", [B])).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(B, "INSERT INTO public.focus_sessions(id,user_id,completed_at,duration_min,area_id) VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd',$1,now(),25,$2)", [B, A_ONLY])).rejects.toMatchObject({ code: "23503" });

    expect((await asUser(null, "SELECT * FROM public.focus_areas")).rows).toEqual([]);
    expect((await db.query("SELECT count(*)::int AS n FROM public.focus_areas WHERE id=$1", [WORK])).rows).toEqual([{ n: 2 }]);
  });
});
