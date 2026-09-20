import { getSupabaseClient } from '../supabase';
import type { AuthResult } from '../authController';

/**
 * "Connect Google Calendar" — deliberately separate from
 * `authController.signInWithGoogle` (identity sign-in). Adding calendar
 * scope to the sign-in flow would pop Google's calendar consent screen on
 * every ordinary login. This is a second, explicit OAuth round-trip issued
 * only when the user opts in, using the raw Supabase client directly
 * (identity's `AuthClientLike` interface is deliberately narrow and has no
 * `scopes`/`queryParams`).
 *
 * `access_type: 'offline'` + `prompt: 'consent'` are required — Google only
 * issues a refresh token on first consent or when consent is forced.
 */
export async function beginGoogleCalendarConnect(redirectTo: string): Promise<AuthResult> {
  const client = await getSupabaseClient();
  if (!client) return { ok: false, message: 'Cloud is not configured on this installation.' };
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'https://www.googleapis.com/auth/calendar.events.readonly',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) return { ok: false, message: error.message || 'Could not start Google connect.' };
    // Success redirects the browser away — nothing left to do here.
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not start Google connect.',
    };
  }
}
