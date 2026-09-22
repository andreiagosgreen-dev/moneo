import type { ReactNode } from 'react';
import MonoHead from './MonoHead';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  children: ReactNode;
}

/** Growth screen shell: head + padded board for Growth / Stats / Insights. */
export default function MonoCrestere({ children }: Props) {
  const { t } = useI18n();
  return (
    <div>
      <MonoHead eyebrow={t('growth.sub')} title={t('growth.title')} />
      <div className="mono-pad">
        <div className="mono-growth-board">{children}</div>
      </div>
    </div>
  );
}
