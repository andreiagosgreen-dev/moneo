import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MonoBtn from './MonoBtn';
import MonoTag from './MonoTag';
import { useI18n } from '../lib/i18n/LocaleContext';
import {
  isTemplateAvailable,
  LIFE_TEMPLATES,
  tplKey,
  type LifeTemplateId,
} from '../lib/lifeTemplates';
import { MonoGlyph, type GlyphName } from './MonoArt';

const TPL_GLYPH: Record<LifeTemplateId, GlyphName> = {
  exam: 'cap',
  sport: 'run',
  moving: 'box',
  reading: 'book',
  newHabit: 'target',
  language: 'globe',
  jobSearch: 'briefcase',
  declutter: 'sparkle',
};

interface Props {
  isPro: boolean;
  /** False when the Free project cap is reached. */
  canCreate: boolean;
  /** With existing projects the gallery starts collapsed so it doesn't push the list down. */
  hasProjects: boolean;
  onCreate: (id: LifeTemplateId) => void;
}

/** "Ready-made systems": one tap sets up a project, its tasks and habits. */
export default function MonoTemplates({ isPro, canCreate, hasProjects, onCreate }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(!hasProjects);
  const [confirming, setConfirming] = useState<LifeTemplateId | null>(null);
  const busy = useRef(false);

  const create = (id: LifeTemplateId) => {
    if (busy.current) return;
    busy.current = true;
    setConfirming(null);
    onCreate(id);
    window.setTimeout(() => {
      busy.current = false;
    }, 0);
  };

  return (
    <details
      className="mono-tpl"
      data-testid="life-templates"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="mono-tpl-summary">
        <span className="mono-tpl-summary-copy">
          <span className="mono-h3">{t('goal.tpl.title')}</span>
          <span className="mono-meta">{t('goal.tpl.sub')}</span>
        </span>
        <span className="mono-tpl-chev" aria-hidden>
          ›
        </span>
      </summary>
      {!canCreate ? (
        <p className="mono-meta mono-tpl-limit" role="note">
          {t('goal.tpl.projectLimit')}{' '}
          <Link to="/pricing" className="mono-link">
            {t('goal.tpl.unlock')}
          </Link>
        </p>
      ) : null}
      <ul className="mono-tpl-grid">
        {LIFE_TEMPLATES.map((tpl) => {
          const name = t(tplKey.name(tpl.id));
          const locked = !isTemplateAvailable(tpl.id, isPro);
          return (
            <li key={tpl.id} className="mono-tpl-card" data-testid={`tpl-${tpl.id}`}>
              <div className="mono-tpl-top">
                <span className="mono-tpl-icon" aria-hidden>
                  <MonoGlyph name={TPL_GLYPH[tpl.id]} />
                </span>
                {locked ? <MonoTag tone="accent">Pro</MonoTag> : null}
              </div>
              <p className="mono-tpl-name">{name}</p>
              <p className="mono-meta">{t(tplKey.desc(tpl.id))}</p>
              <p className="mono-meta mono-tpl-counts">
                {t('goal.tpl.counts', { tasks: tpl.tasks.length, habits: tpl.habits.length })}
              </p>
              {locked ? (
                <div className="mono-tpl-actions">
                  <Link to="/pricing" className="mono-link mono-tpl-lock">
                    {t('goal.tpl.unlock')}
                  </Link>
                </div>
              ) : !canCreate ? null : (
                <div className="mono-tpl-actions">
                  {confirming === tpl.id ? (
                    <>
                      <MonoBtn type="button" variant="primary" onClick={() => create(tpl.id)}>
                        {t('goal.tpl.confirm')}
                      </MonoBtn>
                      <MonoBtn type="button" variant="ghost" onClick={() => setConfirming(null)}>
                        {t('goal.tpl.cancel')}
                      </MonoBtn>
                    </>
                  ) : (
                    <MonoBtn
                      type="button"
                      variant="ghost"
                      aria-label={t('goal.tpl.useAria', { name })}
                      onClick={() => setConfirming(tpl.id)}
                    >
                      {t('goal.tpl.use')}
                    </MonoBtn>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
