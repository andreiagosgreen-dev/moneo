import { useState } from 'react';
import type { Session } from '../lib/store';
import type { Journal } from '../lib/journal';
import { appendSessionReflection, promptForSession } from '../lib/journal';
import { dayKeyInTz } from '../lib/timezone';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  session: Session;
  journal: Journal;
  journalChange: (journal: Journal) => void;
  timezone: string;
  onDone: () => void;
}

export default function PostSessionReflection({
  session,
  journal,
  journalChange,
  timezone,
  onDone,
}: Props) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const prompt = promptForSession(session.at);

  const save = () => {
    const dayKey = dayKeyInTz(session.at, timezone);
    journalChange(appendSessionReflection(journal, dayKey, text));
    onDone();
  };

  return (
    <div className="dialog-pop card fixed bottom-4 right-4 z-40 w-full max-w-sm px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        {t('reflection.kicker')}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-cream/90">{prompt}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={280}
        autoFocus
        placeholder={t('reflection.placeholder')}
        className="mt-2 w-full resize-none rounded-lg bg-ink/60 px-2.5 py-2 text-[13px] text-cream ring-1 ring-inset ring-line focus:ring-accent focus:outline-none"
      />
      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          onClick={onDone}
          className="press rounded-lg px-3 py-1.5 font-mono text-[11px] text-faint hover:text-cream"
        >
          {t('reflection.skip')}
        </button>
        <button
          onClick={save}
          disabled={!text.trim()}
          className="press btn-accent rounded-lg px-4 py-1.5 font-display text-[12px] font-bold disabled:opacity-40"
        >
          {t('reflection.save')}
        </button>
      </div>
    </div>
  );
}
