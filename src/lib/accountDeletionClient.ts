/**
 * Calls the Worker's `/api/account/delete`. True only when the Worker
 * explicitly confirms `{ ok: true }` — a bare 2xx is not enough (a dev
 * server or SPA fallback can answer 200 with HTML), because a true here
 * makes the caller wipe this device.
 */
export async function requestAccountDeletion(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl('/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: unknown } | null;
    return body?.ok === true;
  } catch {
    return false;
  }
}
