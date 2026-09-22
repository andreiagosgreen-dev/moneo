import type { ReactNode } from 'react';
import MonoHead from './MonoHead';
import { useI18n } from '../lib/i18n/LocaleContext';

interface Props {
  activeCount: number;
  children: ReactNode;
}

/** Projects screen shell (V1 prototype): count head + content. */
export default function MonoProiecte({ activeCount, children }: Props) {
  const { t, fmtNum } = useI18n();
  return (
    <div>
      <MonoHead
        eyebrow={t('mono.proj.active', { n: fmtNum(activeCount) })}
        title={t('mono.nav.proiecte')}
      />
      <div className="mono-pad">{children}</div>
    </div>
  );
}
