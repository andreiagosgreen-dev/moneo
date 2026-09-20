import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabase';
import { connectGoogleCalendar } from '../lib/googleCalendar';
import { useI18n } from '../lib/i18n/LocaleContext';

/**
 * OAuth redirect target for "Connect Google Calendar" (Roadmap Faza 10) —
 * deliberately not `/login`, which serves identity sign-in for a different
 * purpose. Supabase only exposes `provider_refresh_token` on the session
 * object immediately after this redirect, never on later `getSession()`
 * calls, so it must be captured here or lost. Captured into local `const`s
 * only — never `setState`, never persisted client-side — then handed to
 * the Worker once and left to fall out of scope. The URL is always
 * replaced afterwards so the token-bearing redirect can't be replayed via
 * back/forward.
 */
export default function CalendarCallback() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const client = await getSupabaseClient();
      if (!client) {
        setError(t('calendar.connect.error'));
        return;
      }
      const { data } = await client.auth.getSession();
      const session = data.session;
      const refreshToken = session?.provider_refresh_token;
      const accessToken = session?.access_token;
      if (accessToken && refreshToken) {
        const ok = await connectGoogleCalendar(accessToken, refreshToken, session?.user?.email);
        if (!ok) setError(t('calendar.connect.error'));
      } else {
        setError(t('calendar.connect.error'));
      }
      navigate('/account', { replace: true });
    })();
  }, [navigate, t]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <p className="text-sm text-faint">{error || t('calendar.connect.connecting')}</p>
    </div>
  );
}
