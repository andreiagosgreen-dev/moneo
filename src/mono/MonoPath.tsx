import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import type { MonoTab } from './MonoNav';

export type MonoPathStep = 'today' | 'focus' | 'orar' | 'map';

interface Props {
  active: MonoPathStep;
  onGo: (tab: MonoTab) => void;
  /** Include Life as step 4 (Map hub only). */
  withLife?: boolean;
}

const BASE: Array<{
  id: Exclude<MonoPathStep, 'map'>;
  n: '1' | '2' | '3';
  labelKey: TKey;
}> = [
  { id: 'today', n: '1', labelKey: 'mono.path.write' },
  { id: 'focus', n: '2', labelKey: 'mono.path.work' },
  { id: 'orar', n: '3', labelKey: 'mono.path.when' },
];

/** Quiet map of the daily spine: write → work → when (+ life on Map). */
export default function MonoPath({ active, onGo, withLife = false }: Props) {
  const { t } = useI18n();
  const steps: Array<{ id: MonoPathStep; n: string; labelKey: TKey }> = withLife
    ? [...BASE, { id: 'map', n: '4', labelKey: 'mono.path.life' }]
    : BASE;

  return (
    <nav className="mono-path" aria-label={t('mono.path.aria')}>
      {steps.map((step, i) => {
        const on = step.id === active;
        return (
          <span key={step.id} className="mono-path-piece">
            {i > 0 && (
              <span className="mono-path-sep" aria-hidden>
                →
              </span>
            )}
            <button
              type="button"
              className={`mono-path-step${on ? ' is-on' : ''}`}
              aria-current={on ? 'step' : undefined}
              onClick={() => onGo(step.id)}
            >
              <span className="mono-path-n">{step.n}</span>
              <span className="mono-path-label">{t(step.labelKey)}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
