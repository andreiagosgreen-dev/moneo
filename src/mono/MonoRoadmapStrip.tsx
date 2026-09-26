import { useI18n } from '../lib/i18n/LocaleContext';
import {
  nextOpenStep,
  roadmapEta,
  roadmapProgress,
  type Roadmap,
} from '../lib/ai/roadmap';
import { RoadmapJourneyTrack, RoadmapProgressRing } from './RoadmapJourney';

interface Props {
  roadmap: Roadmap;
  onOpen: () => void;
  onWorkFocus?: (projectId: string, taskId: string | null) => void;
}

/** Compact progress strip: ring + next step → Focus or Plan. */
export default function MonoRoadmapStrip({ roadmap, onOpen, onWorkFocus }: Props) {
  const { t, fmtNum } = useI18n();
  const next = nextOpenStep(roadmap);
  const eta = roadmapEta(roadmap);
  const pct = roadmapProgress(roadmap);
  const canFocus = Boolean(roadmap.projectId && onWorkFocus);
  const done = roadmap.steps.filter((s) => s.done).length;
  const total = roadmap.steps.length;

  const go = () => {
    if (canFocus && roadmap.projectId) {
      onWorkFocus!(roadmap.projectId, next?.taskId ?? null);
      return;
    }
    onOpen();
  };

  return (
    <button type="button" className="mono-roadmap-strip" onClick={go}>
      <div className="mono-rm-strip-head">
        <RoadmapProgressRing
          pct={pct}
          label={t('assist.roadmap.stepsDone', { done: fmtNum(done), total: fmtNum(total) })}
        />
        <div className="mono-rm-strip-copy">
          <p className="mono-h3" style={{ marginTop: 0, fontSize: 16 }}>
            {roadmap.title}
          </p>
          <p className="mono-meta" style={{ marginTop: 4 }}>
            {next
              ? t('assist.roadmap.next', { step: next.title })
              : t('assist.roadmap.stripDone')}
            {' · '}
            {t('assist.roadmap.etaShort', {
              days: fmtNum(eta.daysLeft),
              pace: fmtNum(eta.paceMinPerDay),
            })}
          </p>
        </div>
      </div>

      <RoadmapJourneyTrack steps={roadmap.steps} compact />

      <div className="mono-rm-strip-foot">
        <span className="mono-rm-strip-cta">
          {canFocus ? t('assist.roadmap.openFocus') : t('assist.roadmap.stripOpen')}
        </span>
      </div>
    </button>
  );
}
