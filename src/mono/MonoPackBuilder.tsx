import { useMemo, useRef, useState } from 'react';
import MonoBtn from './MonoBtn';
import MonoChip from './MonoChip';
import MonoExerciseIcon from './MonoExerciseIcon';
import { fitDose } from './MonoWorkoutPlayer';
import { useI18n } from '../lib/i18n/LocaleContext';
import type { TKey } from '../lib/i18n';
import {
  fitKey,
  getExercise,
  type Equipment,
  type FitLevel,
  type FitPlace,
  type PoseId,
} from '../lib/fitness/library';
import {
  DEFAULT_PACK_CHOICE,
  HOME_GEAR,
  PACK_FORMATS,
  PACK_MINUTES,
  PACK_ZONES,
  WEIGHTED_GEAR,
  WEIGHT_STEPS,
  buildPack,
  type GearProfile,
  type Pack,
  type PackChoice,
  type PackZone,
} from '../lib/fitness/packs';
import { parsePackRequest } from '../lib/fitness/packText';
import { aiPack, packCatalog } from '../lib/fitness/packAi';
import { getSupabaseAccessToken } from '../lib/billing/lemonSqueezy';

interface Props {
  gear?: GearProfile;
  /** Where the user trains; "anywhere" builds for home. */
  place?: FitPlace;
  onGear: (gear: GearProfile) => void;
  onStart: (pack: Pack) => void;
  /** Pro: the request goes to the included AI first. */
  isPro?: boolean;
}

const ZONE_ICON: Record<PackZone, PoseId> = {
  full: 'jack',
  core: 'plank',
  upper: 'pushup',
  lower: 'squat',
  glutes: 'bridge',
  back: 'pullup',
  cardio: 'run',
  mobility: 'cat',
};

const LEVELS: FitLevel[] = [1, 2, 3];
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Quick workout: pick a zone, a length, a format and a level; the pack is built live. */
export default function MonoPackBuilder({ gear, place, onGear, onStart, isPro = false }: Props) {
  const { t, fmtNum } = useI18n();
  const [choice, setChoice] = useState<PackChoice>(gear?.last ?? DEFAULT_PACK_CHOICE);
  const [seed, setSeed] = useState(newSeed);
  const [editing, setEditing] = useState(false);
  // Local copy so quick taps build on each other before the store round-trips.
  const [prof, setProf] = useState<GearProfile>(() => gear ?? { items: [], weights: [] });
  const latest = useRef(prof);
  const { items, weights } = prof;
  const where: FitPlace = place ?? 'home';
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  /** How the last request was read: by the AI, on the device, or not yet. */
  const [madeBy, setMadeBy] = useState<'ai' | 'device' | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  /** Gear the request mentioned, used for this pack on top of My equipment. */
  const [askGear, setAskGear] = useState<Equipment[]>([]);
  const [prefer, setPrefer] = useState<string[]>([]);
  const packGear = useMemo(() => [...new Set([...items, ...askGear])], [items, askGear]);
  const pack = useMemo(
    () => buildPack(choice, where, packGear, seed, prefer),
    [choice, where, packGear, seed, prefer],
  );

  const build = async () => {
    const text = ask.trim();
    if (!text || busy) return;
    const parsed = parsePackRequest(text);
    const gearNow = [...new Set([...items, ...parsed.gear])];
    setAskGear(parsed.gear);
    setAiNote(null);
    if (isPro) {
      setBusy(true);
      const res = await aiPack(text, packCatalog(where, gearNow), getSupabaseAccessToken);
      setBusy(false);
      if (res.ok) {
        setChoice(res.choice);
        setPrefer(res.exercises);
        setSeed(newSeed());
        setMadeBy('ai');
        return;
      }
      if (res.reason === 'daily-limit') setAiNote(t('fit.pack.aiLimit'));
      else if (res.reason === 'busy' || res.reason === 'failed') setAiNote(t('fit.pack.aiBusy'));
    }
    setChoice((c) => ({ ...c, ...parsed.choice }));
    setPrefer([]);
    setSeed(newSeed());
    setMadeBy('device');
  };

  const set = <K extends keyof PackChoice>(key: K, value: PackChoice[K]) => {
    setChoice((c) => ({ ...c, [key]: value }));
    setPrefer([]);
  };
  const update = (fn: (p: GearProfile) => GearProfile) => {
    const next = fn(latest.current);
    latest.current = next;
    setProf(next);
    onGear(next);
  };
  const toggleItem = (e: Equipment) =>
    update((p) => ({
      ...p,
      items: p.items.includes(e) ? p.items.filter((x) => x !== e) : [...p.items, e],
    }));
  const toggleWeight = (w: number) =>
    update((p) => ({
      ...p,
      weights: p.weights.includes(w)
        ? p.weights.filter((x) => x !== w)
        : [...p.weights, w].sort((a, b) => a - b),
    }));
  const hasWeighted = items.some((e) => WEIGHTED_GEAR.includes(e));
  const name = (id: string) => t(fitKey.exName(id));
  const kg = (w: number) => t('fit.pack.kg', { n: fmtNum(w) });

  return (
    <section
      className="mono-card mono-pack"
      aria-labelledby="fit-pack-title"
      data-testid="fit-pack"
    >
      <p className="mono-eyebrow">{t('fit.pack.eyebrow')}</p>
      <h2 className="mono-h2" id="fit-pack-title">
        {t('fit.pack.title2')}
      </h2>
      <p className="mono-meta">{t('fit.pack.sub')}</p>

      <form
        className="mono-pack-ask"
        onSubmit={(e) => {
          e.preventDefault();
          void build();
        }}
      >
        <label className="mono-fit-label">
          <span className="mono-meta">{t('fit.pack.askLabel')}</span>
          <input
            className="mono-field"
            type="text"
            maxLength={300}
            value={ask}
            placeholder={t('fit.pack.askPh')}
            onChange={(e) => setAsk(e.target.value)}
          />
        </label>
        <MonoBtn type="submit" disabled={!ask.trim() || busy}>
          {busy ? t('fit.pack.askBusy') : isPro ? t('fit.pack.askAi') : t('fit.pack.askGo')}
        </MonoBtn>
      </form>
      {madeBy ? (
        <p className="mono-meta mono-fit-small" role="status">
          {madeBy === 'ai' ? t('fit.pack.byAi') : t('fit.pack.byDevice')}
          {aiNote ? ` ${aiNote}` : ''}
        </p>
      ) : !isPro ? (
        <p className="mono-meta mono-fit-small">{t('fit.pack.askProHint')}</p>
      ) : null}

      <div className="mono-pack-zones" role="group" aria-label={t('fit.pack.zoneAria')}>
        {PACK_ZONES.map((z) => (
          <button
            key={z}
            type="button"
            className="mono-pack-zone"
            aria-pressed={choice.zone === z}
            onClick={() => set('zone', z)}
          >
            <MonoExerciseIcon pose={ZONE_ICON[z]} size={34} />
            <span>{t(`fit.pack.zone.${z}` as TKey)}</span>
          </button>
        ))}
      </div>

      <div className="mono-pack-row" role="group" aria-label={t('fit.pack.minAria')}>
        {PACK_MINUTES.map((m) => (
          <MonoChip
            key={m}
            type="button"
            pressed={choice.minutes === m}
            onClick={() => set('minutes', m)}
          >
            {t('fit.pp.min', { n: m })}
          </MonoChip>
        ))}
      </div>

      <div className="mono-pack-row" role="group" aria-label={t('fit.pack.formatAria')}>
        {PACK_FORMATS.map((f) => (
          <MonoChip
            key={f}
            type="button"
            pressed={choice.format === f}
            onClick={() => set('format', f)}
          >
            {t(`fit.pack.format.${f}` as TKey)}
          </MonoChip>
        ))}
      </div>
      <p className="mono-meta mono-fit-small">
        {t(`fit.pack.formatHint.${choice.format}` as TKey)}
      </p>

      <div className="mono-pack-row" role="group" aria-label={t('fit.pack.levelAria')}>
        {LEVELS.map((l) => (
          <MonoChip
            key={l}
            type="button"
            pressed={choice.level === l}
            onClick={() => set('level', l)}
          >
            {t(fitKey.level(l))}
          </MonoChip>
        ))}
      </div>

      <div className="mono-pack-gear">
        <p className="mono-meta">
          {items.length > 0
            ? t('fit.pack.gearList', {
                list: items.map((e) => t(fitKey.eq(e))).join(', '),
              })
            : t('fit.pack.gearNone')}
          {weights.length > 0 ? ` · ${weights.map(kg).join(', ')}` : ''}
        </p>
        <button
          type="button"
          className="mono-link-btn"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? t('fit.plan.close') : t('fit.pack.gearEdit')}
        </button>
      </div>

      {editing ? (
        <div className="mono-pack-gear-edit" data-testid="fit-gear">
          <p className="mono-eyebrow">{t('fit.pack.gearTitle')}</p>
          <div className="mono-pack-row" role="group" aria-label={t('fit.pack.gearTitle')}>
            {HOME_GEAR.map((e) => (
              <MonoChip
                key={e}
                type="button"
                pressed={items.includes(e)}
                onClick={() => toggleItem(e)}
              >
                {t(fitKey.eq(e))}
              </MonoChip>
            ))}
          </div>
          {hasWeighted ? (
            <>
              <p className="mono-eyebrow">{t('fit.pack.weightsTitle')}</p>
              <p className="mono-meta mono-fit-small">{t('fit.pack.weightsHint')}</p>
              <div className="mono-pack-row" role="group" aria-label={t('fit.pack.weightsTitle')}>
                {WEIGHT_STEPS.map((w) => (
                  <MonoChip
                    key={w}
                    type="button"
                    pressed={weights.includes(w)}
                    onClick={() => toggleWeight(w)}
                  >
                    {kg(w)}
                  </MonoChip>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {pack ? (
        <div className="mono-pack-preview" data-testid="fit-pack-preview" aria-live="polite">
          <p className="mono-h3">
            {t('fit.pack.summary', { min: pack.minutes, n: pack.main.length })}
          </p>
          <p className="mono-meta mono-fit-small">
            {choice.format === 'sets'
              ? t('fit.pack.metaSets', { sets: pack.rounds })
              : choice.format === 'tabata'
                ? t('fit.pack.metaTabata', { blocks: pack.rounds })
                : t('fit.pack.metaCircuit', {
                    rounds: pack.rounds,
                    work: pack.workSec,
                    rest: pack.restSec,
                  })}
          </p>
          {pack.warmup.length > 0 ? (
            <p className="mono-meta mono-fit-small">
              <strong>{t('fit.pack.warmup')}</strong> {pack.warmup.map(name).join(' · ')}
            </p>
          ) : null}
          <ol className="mono-pack-list">
            {pack.main.map((id) => {
              const ex = getExercise(id);
              const step = pack.steps.find((s) => s.ex === id);
              if (!ex || !step) return null;
              return (
                <li key={id}>
                  <MonoExerciseIcon pose={ex.pose} size={32} />
                  <span className="mono-pack-name">{name(id)}</span>
                  <span className="mono-meta mono-fit-small mono-fit-num">
                    {choice.format === 'sets'
                      ? fitDose(t, {
                          sets: step.sets,
                          reps: step.reps,
                          sec: step.sec,
                          sides: ex.sides,
                        })
                      : t('fit.pack.secShort', {
                          n: choice.format === 'tabata' ? 20 : pack.workSec,
                        })}
                  </span>
                </li>
              );
            })}
          </ol>
          {pack.cooldown.length > 0 ? (
            <p className="mono-meta mono-fit-small">
              <strong>{t('fit.pack.cooldown')}</strong> {pack.cooldown.map(name).join(' · ')}
            </p>
          ) : null}
          <div className="mono-fit-actions">
            <MonoBtn type="button" onClick={() => onStart(pack)}>
              {t('fit.start')}
            </MonoBtn>
            <MonoBtn type="button" variant="ghost" onClick={() => setSeed(newSeed())}>
              {t('fit.pack.shuffle')}
            </MonoBtn>
          </div>
        </div>
      ) : (
        <p className="mono-meta" role="status">
          {t('fit.pack.empty')}
        </p>
      )}
    </section>
  );
}
