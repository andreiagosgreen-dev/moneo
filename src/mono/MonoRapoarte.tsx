import type { ReactNode } from 'react';
import MonoHead from './MonoHead';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  children: ReactNode;
}

/** Reports screen shell (V1 prototype): head + content. */
export default function MonoRapoarte({ children }: Props) {
  const { t } = useI18n();
  return (
    <div>
      <MonoHead eyebrow={t('rep.sub')} title={t('rep.title')} />
      <div className="mono-pad">{children}</div>
    </div>
  );
}
