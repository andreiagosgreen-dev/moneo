import type { Settings, Session } from "../store";
import type { FocusArea } from "../focusAreas";
import {
  newSessionId,
  replaceSessionById,
  sessionFromRemoteRow,
} from "../sessions";
import {
  planAreaMerge,
  planSessionMerge,
  planSettingsMerge,
  remoteOnlyAreas,
  type RemoteAreaRow,
  type RemoteSessionRow,
  type RemoteSettingsRow,
} from "./merge";
import { loadSyncState, markSyncSuccess, type SyncState } from "./syncState";
import { runLocalMigrations } from "../storage/migrations";
import { resolveCloudAreaId, resolveLocalAreaId } from "../focusAreas";

/**
 * Moneo sync engine (Gate 9).
 *
 * Principles: LOCAL FIRST · USER CONTROLLED · CLOUD ENHANCED.
 * - Explicit consent gates the first sync; signing in uploads nothing.
 * - Sessions are append-mostly immutable; identity = session.id.
 *   Same-id conflict → remote canonical: the local copy is REPLACED with the
 *   remote payload (terminal — the next sync is a zero-op). Counted in outcome.
 * - Areas: newer updatedAt wins; tie → remote canonical.
 * - Settings: last-write-wins on updatedAt; equal → noop.
 * - Failure at ANY stage leaves local data intact and sync state
 *   un-advanced; rerunning converges (idempotent upserts).
 * - Growth/stats are never synced — they recompute from merged history.
 * - Never throws; every outcome is a plain SyncOutcome.
 */

export interface SyncRepos {
  pullSessions(userId: string): Promise<RemoteSessionRow[] | null>;
  pushSessions(
    userId: string,
    sessions: Array<{ id: string; at: number; min: number; intention?: string; areaId?: string }>,
  ): Promise<boolean>;
  pullAreas(userId: string): Promise<RemoteAreaRow[] | null>;
  pushAreas(userId: string, areas: FocusArea[]): Promise<boolean>;
  pullSettings(userId: string): Promise<RemoteSettingsRow | null>;
  pushSettings(userId: string, settings: Settings): Promise<boolean>;
}

export interface SyncLocalIO {
  readHistory(): Session[];
  writeHistory(h: Session[]): boolean;
  readAreas(): FocusArea[];
  writeAreas(a: FocusArea[]): boolean;
  readSettings(): Settings;
  writeSettings(s: Settings): boolean;
}

export type SyncStage =
  | "auth"
  | "consent"
  | "backfill"
  | "pull"
  | "apply"
  | "push"
  | "done"
  | "failed";

export interface SyncOutcome {
  ok: boolean;
  stage: SyncStage;
  insertedSessions: number;
  adoptedSessions: number;
  pushedAreas: number;
  appliedRemoteAreas: number;
  settingsOp: "pushLocal" | "applyRemote" | "noop" | "none";
  conflicts: number;
  error?: string;
  state?: SyncState;
}

const fail = (stage: SyncStage, error: string): SyncOutcome => ({
  ok: false,
  stage,
  insertedSessions: 0,
  adoptedSessions: 0,
  pushedAreas: 0,
  appliedRemoteAreas: 0,
  settingsOp: "none",
  conflicts: 0,
  error,
});

export async function runSync(opts: {
  userId: string | null;
  /** Explicit first-sync consent; ignored once initialized. */
  consented: boolean;
  repos: SyncRepos;
  local: SyncLocalIO;
  now?: () => number;
}): Promise<SyncOutcome> {
  const now = (opts.now ?? Date.now)();

  // 1. Auth — unsigned users never touch cloud sync.
  if (!opts.userId) return fail("auth", "Not signed in.");

  // 2. Consent — first sync requires an explicit user action.
  const state = loadSyncState();
  if (!state.initialized && !opts.consented) {
    return fail("consent", "First sync requires explicit consent.");
  }

  // 3. Backfill — guarantee exactly one stable id per local session
  //    (idempotent; entries that already have ids are never re-stamped).
  const migration = runLocalMigrations();
  if (migration.status === "failed") {
    return fail("backfill", "Could not prepare local storage.");
  }
  {
    const pre = opts.local.readHistory();
    if (pre.some((s) => typeof s.id !== "string" || s.id.length === 0)) {
      const stamped = pre.map((s) =>
        typeof s.id === "string" && s.id.length > 0 ? s : { ...s, id: newSessionId() },
      );
      if (!opts.local.writeHistory(stamped)) {
        return fail("backfill", "Could not prepare local session ids.");
      }
    }
  }

  // 4. Pull — any failure aborts before anything local or remote changes.
  let remoteSessions: RemoteSessionRow[] | null = null;
  let remoteAreas: RemoteAreaRow[] | null = null;
  let remoteSettings: RemoteSettingsRow | null = null;
  try {
    [remoteSessions, remoteAreas, remoteSettings] = await Promise.all([
      opts.repos.pullSessions(opts.userId),
      opts.repos.pullAreas(opts.userId),
      opts.repos.pullSettings(opts.userId),
    ]);
  } catch {
    remoteSessions = null;
  }
  // pullSettings returning null legitimately means "no row yet"; the
  // guaranteed tables (sessions/areas) are the abort signal.
  if (!remoteSessions || !remoteAreas) {
    return fail("pull", "Could not reach your account — nothing changed.");
  }

  // 5. Plan — pure, deterministic merge decisions.
  const localHistory = opts.local.readHistory();
  const localAreas = opts.local.readAreas();
  const localSettings = opts.local.readSettings();

  // Local storage keeps LOCAL area ids; the cloud speaks cloud UUIDs. Normalize
  // a copy of local history to cloud area identity so merge comparison and the
  // push both operate in cloud space (R1). Unresolvable refs become an explicit
  // null — never a non-UUID local id and never a false "associated" claim.
  const normalizedForMerge = localHistory.map((s) => ({
    ...s,
    areaId: s.areaId
      ? resolveCloudAreaId(localAreas, s.areaId) ?? undefined
      : undefined,
  }));

  const sessionPlan = planSessionMerge(normalizedForMerge, remoteSessions);
  const areaPlan = planAreaMerge(localAreas, remoteAreas);
  const remoteOnly = remoteOnlyAreas(localAreas, remoteAreas);
  const settingsOp = planSettingsMerge(localSettings, remoteSettings);

  // Map a remote (cloud) area id back to a LOCAL area id for adoption.
  // Remote-only areas are adopted with local id == their cloud id.
  const resolveToLocal = (cloudAreaId: string | null): string | null => {
    if (!cloudAreaId) return null;
    const local = resolveLocalAreaId(localAreas, cloudAreaId);
    if (local) return local;
    return remoteOnly.some((r) => r.id === cloudAreaId) ? cloudAreaId : null;
  };

  // 6. Apply local-safe changes BEFORE pushing (crash-safe: a failed push
  //    still leaves the user with merged data; the next run converges).
  let appliedRemoteAreas = 0;
  try {
    const hasAdoptions = sessionPlan.adoptLocal.length > 0;
    const hasConflicts = sessionPlan.resolveConflictRemoteCanonical.length > 0;
    if (hasAdoptions || hasConflicts) {
      let nextHistory = localHistory;

      // Append remote-only sessions (adoption).
      if (hasAdoptions) {
        const adopted: Session[] = sessionPlan.adoptLocal.map((r) => {
          // Preserve local semantics: store the LOCAL area id, not the cloud UUID.
          const localAreaId = resolveToLocal(r.areaId);
          return {
            id: r.id,
            at: r.at,
            min: r.min,
            ...(r.intention ? { intention: r.intention } : {}),
            ...(localAreaId ? { areaId: localAreaId } : {}),
          };
        });
        nextHistory = [...nextHistory, ...adopted];
      }

      // Remote-canonical conflicts: replace the matching local session by id
      // with the canonical remote payload (same id, no new UUID, no duplicate).
      for (const r of sessionPlan.resolveConflictRemoteCanonical) {
        nextHistory = replaceSessionById(
          nextHistory,
          sessionFromRemoteRow({
            id: r.id,
            at: r.at,
            min: r.min,
            intention: r.intention,
            // Preserve local semantics: store the LOCAL area id.
            areaId: resolveToLocal(r.areaId),
          }),
        );
      }

      // Normalize ordering by completion time — the same invariant adoption
      // already enforces. Entries are preserved; only order is canonicalized.
      const merged = [...nextHistory].sort((a, b) => a.at - b.at);
      if (!opts.local.writeHistory(merged)) return fail("apply", "storage");
    }

    let nextAreas = localAreas;
    let areasChanged = false;
    for (const { areaId, op } of areaPlan.ops) {
      if (op.kind !== "applyLocal") continue;
      areasChanged = true;
      appliedRemoteAreas++;
      nextAreas = nextAreas.map((a) =>
        a.id === areaId
          ? {
              ...a,
              name: op.remote.name,
              updatedAt: op.remote.updatedAt,
              deletedAt: op.remote.deletedAt ?? undefined,
            }
          : a,
      );
    }
    if (remoteOnly.length > 0) {
      areasChanged = true;
      appliedRemoteAreas += remoteOnly.length;
      nextAreas = [
        ...nextAreas,
        ...remoteOnly.map((r) => ({
          // Adopted with local id == cloud id, so its cloud identity is itself.
          id: r.id,
          cloudId: r.id,
          name: r.name,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          ...(r.deletedAt !== null ? { deletedAt: r.deletedAt } : {}),
        })),
      ];
    }
    if (areasChanged && !opts.local.writeAreas(nextAreas)) {
      return fail("apply", "storage");
    }

    if (settingsOp === "applyRemote" && remoteSettings) {
      const applied: Settings = {
        focusMin: remoteSettings.focusMin,
        shortMin: remoteSettings.shortMin,
        longMin: remoteSettings.longMin,
        longEvery: remoteSettings.longEvery,
        dailyGoal: remoteSettings.dailyGoal,
        autoStart: remoteSettings.autoStart,
        sound: remoteSettings.sound,
        soundType: (remoteSettings.soundType || "bell") as any,
        volume: remoteSettings.volume || 50,
        notifications: remoteSettings.notifications !== undefined ? remoteSettings.notifications : true,
        updatedAt: remoteSettings.updatedAt,
      };
      if (!opts.local.writeSettings(applied)) return fail("apply", "storage");
    } else if (settingsOp === "pushLocal" && localSettings.updatedAt === undefined) {
      // Give local settings a trustworthy stamp before their first push.
      if (!opts.local.writeSettings({ ...localSettings, updatedAt: now })) {
        return fail("apply", "storage");
      }
    }
  } catch {
    return fail("apply", "Unexpected local write failure.");
  }

  // 7. Push — batched, idempotent (onConflict ignore-duplicates).
  let pushedAreas = 0;
  try {
    // Referenced areas must exist before session inserts satisfy the scoped FK.
    const areasToPush = areaPlan.ops
      .filter(
        (o): o is { areaId: string; op: { kind: "pushInsert" | "pushUpdate"; area: FocusArea } } =>
          o.op.kind === "pushInsert" || o.op.kind === "pushUpdate",
      )
      .map((o) => o.op.area);
    if (areasToPush.length > 0) {
      const ok = await opts.repos.pushAreas(opts.userId, areasToPush);
      if (!ok) return fail("push", "Area upload failed — local data is safe.");
      pushedAreas = areasToPush.length;
    }
    if (sessionPlan.insertRemote.length > 0) {
      const ok = await opts.repos.pushSessions(
        opts.userId,
        sessionPlan.insertRemote,
      );
      if (!ok) return fail("push", "Session upload failed — local data is safe.");
    }
    if (settingsOp === "pushLocal") {
      const toPush = opts.local.readSettings();
      const ok = await opts.repos.pushSettings(opts.userId, {
        ...toPush,
        updatedAt: toPush.updatedAt ?? now,
      });
      if (!ok) return fail("push", "Settings upload failed — local data is safe.");
    }
  } catch {
    return fail("push", "Network failure — local data is safe, retry later.");
  }

  // 8. Mark success — only a COMPLETE run advances sync state.
  const nextState = markSyncSuccess(now);
  if (!nextState) return fail("apply", "Could not save sync state.");
  return {
    ok: true,
    stage: "done",
    insertedSessions: sessionPlan.insertRemote.length,
    adoptedSessions: sessionPlan.adoptLocal.length,
    pushedAreas,
    appliedRemoteAreas,
    settingsOp,
    conflicts: sessionPlan.resolveConflictRemoteCanonical.length,
    state: nextState,
  };
}
