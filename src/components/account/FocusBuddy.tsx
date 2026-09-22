import { useEffect, useState } from 'react';
import {
  currentAccessToken,
  fetchBuddyStatus,
  inviteBuddy,
  joinBuddy,
  unpairBuddy,
  type BuddyStatus,
} from '../../lib/cloud/focusBuddyClient';
import { useI18n } from '../../lib/i18n/LocaleContext';

interface Props {
  isPro: boolean;
}

/**
 * Focus buddy (Faza 25) — one connected person, sees only today's focused
 * minutes. No feed, no leaderboard. Same inline-ternary Pro-gating idiom
 * used everywhere else in the app.
 */
export default function FocusBuddy({ isPro }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    const token = await currentAccessToken();
    if (!token) return;
    setStatus(await fetchBuddyStatus(token));
  };

  useEffect(() => {
    if (isPro) void refresh();
  }, [isPro]);

  if (!isPro) {
    return (
      <div>
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          {t('buddy.title')}
        </h2>
        <p className="mt-2 text-[12px] text-faint">{t('buddy.proOnly')}</p>
      </div>
    );
  }

  const runAction = async (fn: () => Promise<boolean | string | null>) => {
    setBusy(true);
    setError('');
    const result = await fn();
    if (result === false || result === null) setError(t('buddy.error'));
    await refresh();
    setBusy(false);
    return result;
  };

  const invite = () => runAction(async () => await inviteBuddy((await currentAccessToken()) ?? ''));
  const join = () =>
    runAction(async () => await joinBuddy((await currentAccessToken()) ?? '', joinCode));
  const unpair = () => runAction(async () => await unpairBuddy((await currentAccessToken()) ?? ''));

  return (
    <div>
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
        {t('buddy.title')}
      </h2>
      <p className="mt-1 text-[12px] text-faint">{t('buddy.subtitle')}</p>

      {error && <p className="mt-2 text-[12px] text-tomato">{error}</p>}

      {status?.paired ? (
        <div className="mt-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
          <p className="text-sm text-cream">
            {t('buddy.todayMinutes', { n: String(status.todayMinutes ?? 0) })}
          </p>
          <button
            onClick={unpair}
            disabled={busy}
            className="press mt-2 rounded-lg px-3 py-1.5 font-mono text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato disabled:opacity-40"
          >
            {t('buddy.unpair')}
          </button>
        </div>
      ) : status?.pendingCode ? (
        <div className="mt-3 rounded-xl border border-line bg-ink/50 px-4 py-3">
          <p className="text-[12px] text-faint">{t('buddy.waitingForBuddy')}</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-widest text-accent">
            {status.pendingCode}
          </p>
          <button
            onClick={unpair}
            disabled={busy}
            className="press mt-2 rounded-lg px-3 py-1.5 font-mono text-[11px] text-faint ring-1 ring-inset ring-line hover:text-tomato disabled:opacity-40"
          >
            {t('buddy.cancelInvite')}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <button
            onClick={invite}
            disabled={busy}
            className="press btn-accent rounded-lg px-4 py-2 font-display text-[12px] font-bold disabled:opacity-40"
          >
            {t('buddy.invite')}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder={t('buddy.codePlaceholder')}
              className="h-9 min-w-0 flex-1 rounded-lg bg-ink/40 px-3 font-mono text-sm uppercase text-cream ring-1 ring-inset ring-line placeholder:normal-case placeholder:text-faint focus:ring-accent focus:outline-none"
            />
            <button
              onClick={join}
              disabled={busy || !joinCode.trim()}
              className="press btn-ghost rounded-lg px-4 py-2 font-mono text-[12px] font-semibold disabled:opacity-40"
            >
              {t('buddy.join')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
