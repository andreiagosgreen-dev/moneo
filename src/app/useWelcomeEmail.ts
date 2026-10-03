import { useEffect } from 'react';
import { currentSource } from '../lib/attribution';
import { getSupabaseAccessToken } from '../lib/billing/lemonSqueezy';

const sentKey = (userId: string) => `moneo:welcome-requested:${userId}`;

/** Channel for the anonymous sign-up counter; `count: false` honours DNT/GPC. */
function welcomeChannel(): { s?: string; c?: string; count: boolean } {
  const { source, campaign } = currentSource();
  if (!source) return { count: false };
  return { s: source, ...(campaign ? { c: campaign } : {}), count: true };
}

/**
 * After the first sign-in on a device, ask the Worker for the welcome email
 * once, in the app's language. The Worker decides whether to send (new
 * accounts only, once per account), so a repeat call is harmless.
 */
export function useWelcomeEmail(userId: string | null, locale: string): void {
  useEffect(() => {
    if (!userId) return;
    try {
      if (localStorage.getItem(sentKey(userId))) return;
    } catch {
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getSupabaseAccessToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch('/api/email/welcome', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale, ...welcomeChannel() }),
        });
        if (res.ok) localStorage.setItem(sentKey(userId), '1');
      } catch {
        /* offline or blocked — try again next time */
      }
    })();
    return () => {
      cancelled = true;
    };
    // The language is read once; switching it later does not resend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
