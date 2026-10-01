import { useState } from 'react';
import { Link } from 'react-router-dom';
import MonoLegalLinks from '../../mono/MonoLegalLinks';
import { useI18n } from '../../lib/i18n/LocaleContext';
import { getLegalDoc, legalLangFor } from '../../lib/legal/content';
import { LEGAL_DOCS, type LegalDocId, type LegalLang } from '../../lib/legal/seller';
import LegalInline from './LegalInline';

interface Props {
  doc: LegalDocId;
}

/**
 * Terms / Privacy / Refund. English is authoritative; every other interface
 * language shows a full translation under a localized "English is binding"
 * note, with a switch to the English original.
 */
export default function LegalPage({ doc }: Props) {
  const { t, locale } = useI18n();
  const preferred = legalLangFor(locale);
  const [showOriginal, setShowOriginal] = useState(false);
  const lang: LegalLang = showOriginal ? 'en' : preferred;
  const content = getLegalDoc(doc, lang);
  const docLabels = Object.fromEntries(
    LEGAL_DOCS.map((id) => [id, getLegalDoc(id, lang).title]),
  ) as Record<LegalDocId, string>;
  const inline = (text: string) => (
    <LegalInline text={text} docLabels={docLabels} linkClassName="mono-link" />
  );

  return (
    <div className="mono min-h-screen">
      <div className="mono-legal">
        <Link to="/" className="mono-legal-back">
          {t('help.back')}
        </Link>

        {locale !== 'en' && (
          <p role="note" className="mono-legal-note">
            {t('legal.bindingNote')}
            {preferred !== 'en' && (
              <>
                {' '}
                <button
                  type="button"
                  className="mono-legal-switch"
                  onClick={() => setShowOriginal((v) => !v)}
                >
                  {showOriginal ? t('legal.showTranslation') : t('legal.showEnglish')}
                </button>
              </>
            )}
          </p>
        )}

        <article lang={lang}>
          <p className="mono-eyebrow">Moneo</p>
          <h1 className="mono-h1">{content.title}</h1>
          <p className="mono-meta mono-legal-updated">{content.updated}</p>
          {content.intro.map((p, i) => (
            <p key={i} className="mono-legal-p">
              {inline(p)}
            </p>
          ))}
          {content.sections.map((s) => (
            <section key={s.heading} className="mono-legal-sec">
              <h2 className="mono-h2">{s.heading}</h2>
              {s.blocks.map((b, i) =>
                typeof b === 'string' ? (
                  <p key={i} className="mono-legal-p">
                    {inline(b)}
                  </p>
                ) : (
                  <ul key={i} className="mono-legal-list">
                    {b.list.map((item, j) => (
                      <li key={j}>{inline(item)}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>

        <MonoLegalLinks showHelp className="mono-legal-foot" />
      </div>
    </div>
  );
}
