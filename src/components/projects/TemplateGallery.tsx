import { PROJECT_TEMPLATES, availableTemplates } from '../../lib/projectTemplates';
import { useI18n } from '../../lib/i18n/LocaleContext';

export interface TemplateGalleryProps {
  isPro: boolean;
  onInstantiate: (templateId: string) => void;
}

/** Template picker panel (moved verbatim out of ProjectsCard). */
export default function TemplateGallery({ isPro, onInstantiate }: TemplateGalleryProps) {
  const { t, tp, fmtNum } = useI18n();
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-line bg-ink/60 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
        {t('proj.tplHead', {
          a: fmtNum(availableTemplates(isPro).length),
          b: fmtNum(PROJECT_TEMPLATES.length),
        })}
      </p>
      {PROJECT_TEMPLATES.map((tpl) => {
        const locked = tpl.pro && !isPro;
        return (
          <div
            key={tpl.id}
            className={`rounded-lg px-3 py-2.5 ring-1 ring-inset ${
              locked ? 'bg-ink/20 ring-line/50' : 'bg-ink/40 ring-line'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tpl.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-semibold text-cream">{tpl.name}</span>
                <span className="ml-2 font-mono text-[10px] text-faint">
                  {tp('proj.tplTasks', tpl.tasks.length)} · {tpl.stack.slice(0, 3).join(' · ')}
                </span>
              </div>
              {locked ? (
                <span
                  className="shrink-0 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-accent ring-1 ring-inset ring-accent/40"
                  title={t('proj.proTitle')}
                >
                  Pro
                </span>
              ) : (
                <button
                  onClick={() => onInstantiate(tpl.id)}
                  className="press shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] text-cream ring-1 ring-inset ring-line hover:ring-accent"
                >
                  {t('proj.use')}
                </button>
              )}
            </div>
            <p className="mt-1 truncate text-[11px] text-faint" title={tpl.description}>
              {tpl.description}
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer font-mono text-[10px] text-sage hover:text-cream">
                {t('proj.practices')}
              </summary>
              <ul className="mt-1 space-y-1">
                {tpl.bestPractices.map((b) => (
                  <li key={b} className="text-[11px] text-sage">
                    ✓ {b}
                  </li>
                ))}
                {tpl.pitfalls.map((p) => (
                  <li key={p} className="text-[11px] text-faint">
                    ✕ {p}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      })}
    </div>
  );
}
