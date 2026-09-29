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

interface Props {
  isPro: boolean;
  /** False when the Free project cap is reached. */
  canCreate: boolean;
  onCreate: (id: LifeTemplateId) => void;
}

/** "Ready-made systems": one tap sets up a project, its tasks and habits. */
export default function MonoTemplates({ isPro, canCreate, onCreate }: Props) {
  const { t } = useI18n();
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
    <section className="mono-tpl" aria-labelledby="mono-tpl-title" data-testid="life-templates">
      <p id="mono-tpl-title" className="mono-h3">
        {t('goal.tpl.title')}
      </p>
      <p className="mono-meta" style={{ marginTop: 2 }}>
        {t('goal.tpl.sub')}
      </p>
      <ul className="mono-tpl-grid">
        {LIFE_TEMPLATES.map((tpl) => {
          const name = t(tplKey.name(tpl.id));
          const locked = !isTemplateAvailable(tpl.id, isPro);
          return (
            <li key={tpl.id} className="mono-tpl-card" data-testid={`tpl-${tpl.id}`}>
              <div className="mono-tpl-top">
                <span className="mono-tpl-icon" aria-hidden>
                  {tpl.icon}
                </span>
                {locked ? <MonoTag tone="accent">Pro</MonoTag> : null}
              </div>
              <p className="mono-tpl-name">{name}</p>
              <p className="mono-meta">{t(tplKey.desc(tpl.id))}</p>
              <p className="mono-meta mono-tpl-counts">
                {t('goal.tpl.counts', { tasks: tpl.tasks.length, habits: tpl.habits.length })}
              </p>
              <div className="mono-tpl-actions">
                {locked ? (
                  <Link to="/pricing" className="mono-link mono-tpl-lock">
                    {t('goal.tpl.unlock')}
                  </Link>
                ) : !canCreate ? (
                  <>
                    <p className="mono-meta" role="note">
                      {t('goal.tpl.projectLimit')}
                    </p>
                    <Link to="/pricing" className="mono-link">
                      {t('goal.tpl.unlock')}
                    </Link>
                  </>
                ) : confirming === tpl.id ? (
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
