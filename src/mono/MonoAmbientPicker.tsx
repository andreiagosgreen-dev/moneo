import { Link } from 'react-router-dom';
import MonoTag from './MonoTag';
import { soundsUnlockedByRank } from '../lib/rankRewards';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n/types';
import {
  AMBIENT_IDS,
  FREE_AMBIENT,
  MAX_LAYERS,
  type AmbientId,
  type AmbientLayer,
} from '../lib/ambient';

interface Props {
  layers: AmbientLayer[];
  isPro: boolean;
  onChange: (layers: AmbientLayer[]) => void;
  wakeLock: boolean;
  onWakeLock: (on: boolean) => void;
}

const nameKey = (id: AmbientId) => `mono.focus.amb.${id}` as TKey;

/** Ambient sound choice: one free sound on Free, a mixer of up to 3 on Pro. */
export default function MonoAmbientPicker({
  layers,
  isPro,
  onChange,
  wakeLock,
  onWakeLock,
}: Props) {
  const { t } = useI18n();
  const rankSounds = soundsUnlockedByRank();
  const volumeOf = (id: AmbientId) => layers.find((l) => l.id === id)?.volume;
  const setVolume = (id: AmbientId, volume: number) =>
    onChange(layers.map((l) => (l.id === id ? { ...l, volume } : l)));

  const slider = (id: AmbientId) => {
    const name = t(nameKey(id));
    return (
      <input
        type="range"
        className="mono-amb-vol"
        min={0}
        max={100}
        step={5}
        value={Math.round((volumeOf(id) ?? 0.6) * 100)}
        aria-label={t('mono.focus.amb.volume', { name })}
        onChange={(e) => setVolume(id, Number(e.target.value) / 100)}
      />
    );
  };

  const freeList = (
    <div role="radiogroup" aria-label={t('mono.focus.sound')} className="mono-amb-list">
      {AMBIENT_IDS.map((id) => {
        const locked = !FREE_AMBIENT.includes(id) && !rankSounds.includes(id);
        const checked = !locked && volumeOf(id) !== undefined;
        return (
          <div key={id} className="mono-amb-row">
            <label className={locked ? 'mono-amb-opt is-locked' : 'mono-amb-opt'}>
              <input
                type="radio"
                name="mono-amb"
                checked={checked}
                disabled={locked}
                onChange={() => onChange([{ id, volume: layers[0]?.volume ?? 0.6 }])}
              />
              <span>{t(nameKey(id))}</span>
              {locked ? <MonoTag tone="accent">Pro</MonoTag> : null}
            </label>
            {checked ? slider(id) : null}
          </div>
        );
      })}
      <p className="mono-meta mono-amb-hint">
        <Link to="/pricing" className="mono-link">
          {t('mono.focus.amb.proHint')}
        </Link>
      </p>
    </div>
  );

  const full = layers.length >= MAX_LAYERS;
  const mixer = (
    <div role="group" aria-label={t('mono.focus.amb.mixer')} className="mono-amb-list">
      <p className="mono-meta">{t('mono.focus.amb.mixer')}</p>
      {AMBIENT_IDS.map((id) => {
        const on = volumeOf(id) !== undefined;
        return (
          <div key={id} className="mono-amb-row">
            <label className="mono-amb-opt">
              <input
                type="checkbox"
                checked={on}
                disabled={!on && full}
                onChange={() =>
                  onChange(
                    on ? layers.filter((l) => l.id !== id) : [...layers, { id, volume: 0.6 }],
                  )
                }
              />
              <span>{t(nameKey(id))}</span>
            </label>
            {on ? slider(id) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mono-amb" data-testid="ambient-picker">
      {isPro ? mixer : freeList}
      <label className="mono-amb-opt mono-amb-wake">
        <input type="checkbox" checked={wakeLock} onChange={(e) => onWakeLock(e.target.checked)} />
        <span>{t('mono.focus.wake')}</span>
      </label>
    </div>
  );
}
