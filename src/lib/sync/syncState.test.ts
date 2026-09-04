import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../storage/storageKeys";
import {
  SYNC_STATE_VERSION,
  getOrCreateDeviceId,
  loadSyncState,
  markSyncSuccess,
  newDeviceId,
  onSyncStateChange,
  saveSyncState,
} from "./syncState";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  localStorage.clear();
});

describe("device identity", () => {
  it("generates a UUID-shaped id and persists it exactly once", () => {
    const id = getOrCreateDeviceId();
    expect(UUID_RE.test(id)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.syncState)).not.toBeNull();
  });

  it("is stable across reloads — never regenerated per boot", () => {
    const first = getOrCreateDeviceId();
    expect(getOrCreateDeviceId()).toBe(first);
    expect(loadSyncState().deviceId).toBe(first);
  });

  it("regenerates only an invalid stored id", () => {
    localStorage.setItem(
      STORAGE_KEYS.syncState,
      JSON.stringify({ deviceId: "not-a-uuid", initialized: true }),
    );
    const s = loadSyncState();
    expect(UUID_RE.test(s.deviceId)).toBe(true);
    expect(s.deviceId).not.toBe("not-a-uuid");
    expect(s.initialized).toBe(true); // other fields survive
  });
});

describe("sync state semantics", () => {
  it("starts uninitialized with no last-sync time", () => {
    const s = loadSyncState();
    expect(s.initialized).toBe(false);
    expect(s.lastSuccessfulSyncAt).toBeNull();
    expect(s.version).toBe(SYNC_STATE_VERSION);
  });

  it("falls back safely on corrupt JSON without throwing", () => {
    localStorage.setItem(STORAGE_KEYS.syncState, "{{{");
    expect(() => loadSyncState()).not.toThrow();
    const s = loadSyncState();
    expect(s.initialized).toBe(false);
    expect(UUID_RE.test(s.deviceId)).toBe(true);
  });

  it("markSyncSuccess advances initialized and lastSuccessfulSyncAt", () => {
    const s = markSyncSuccess(123456);
    expect(s.initialized).toBe(true);
    expect(s.lastSuccessfulSyncAt).toBe(123456);
    expect(loadSyncState().initialized).toBe(true);
  });

  it("ignores a malformed lastSuccessfulSyncAt", () => {
    localStorage.setItem(
      STORAGE_KEYS.syncState,
      JSON.stringify({ deviceId: newDeviceId(), lastSuccessfulSyncAt: "soon" }),
    );
    expect(loadSyncState().lastSuccessfulSyncAt).toBeNull();
  });
});

describe("change channel", () => {
  it("notifies subscribers on save and supports unsubscribe", () => {
    let calls = 0;
    const off = onSyncStateChange(() => calls++);
    saveSyncState(loadSyncState());
    expect(calls).toBe(1);
    off();
    saveSyncState(loadSyncState());
    expect(calls).toBe(1);
  });
});
