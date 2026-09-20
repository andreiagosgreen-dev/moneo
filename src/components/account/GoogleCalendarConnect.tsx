import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/LocaleContext';
import { getSupabaseClient } from '../../lib/supabase';
import { beginGoogleCalendarConnect } from '../../lib/cloud/googleCalendarAuth';
import {
  fetchCalendarStatus,
  disconnectGoogleCalendar,
  type CalendarConnectionStatus,
} from '../../lib/googleCalendar';

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * "Connect Google Calendar" (Roadmap Faza 10) — read-only. Same
 * inline-ternary Pro-gating idiom used everywhere in this codebase
 * (`CalendarCard.tsx`, `SkillsCard.tsx`, `OkrCard.tsx`), no new
 * abstraction. Never shows or stores the refresh token — that lives only
 * server-side, captured once by `CalendarCallback.tsx`.
 */
export default function GoogleCalendarConnect({ isPro }: { isPro: boolean }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<CalendarConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const client = await getSupabaseClient();
      const token = (await client?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      const s = await fetchCalendarStatus(token);
      if (!cancelled) {
        setStatus(s);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPro]);

  const connect = async () => {
    setBusy(true);
    setError('');
    const res = await beginGoogleCalendarConnect(
      `${window.location.origin}/account/calendar-callback`,
    );
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
    }
    // On success the browser navigates away to Google — nothing left to do.
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    const client = await getSupabaseClient();
    const token = (await client?.auth.getSession())?.data.session?.access_token;
    const ok = token ? await disconnectGoogleCalendar(token) : false;
    setBusy(false);
    if (ok) setStatus({ connected: false });
    else setError(t('calendar.connect.error'));
  };

  if (!isPro) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/10 p-3.5">
        <div className="text-[13px] font-semibold text-cream">
          {t('calendar.connect.upsellTitle')}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-sage">
          {t('calendar.connect.upsellBody')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-[12px] text-faint">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
      {status.connected ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-cream">
              {t('calendar.connect.connectedTitle')}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
              {status.googleEmail ?? t('calendar.connect.connectedGeneric')}
            </div>
          </div>
          <button
            onClick={() => void disconnect()}
            disabled={busy}
            className="press btn-ghost flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {t('calendar.connect.disconnect')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-cream">
              {t('calendar.connect.title')}
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
              {t('calendar.connect.description')}
            </p>
          </div>
          <button
            onClick={() => void connect()}
            disabled={busy}
            className="press btn-ghost flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 font-mono text-[12px] disabled:opacity-50"
          >
            {busy ? <Spinner /> : null}
            {t('calendar.connect.connect')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-tomato">
          {error}
        </p>
      )}
    </div>
  );
}
