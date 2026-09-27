import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'react-router-dom';
import type { Dictionary } from '../lib/i18n';
import type { Locale, TKey, Vars } from '../lib/i18n/types';
import { LOCALES, isLocale, saveLocale } from '../lib/i18n/meta';
import { FREE_PRICE, PLAN_FEATURE_KEYS, PRO_PRICES, SYNC_SCOPE_KEY } from '../lib/billing/prices';
import {
  ADULT_AGE,
  DIGITAL_CONSENT_AGE,
  LEGAL_PATHS,
  MIN_ACCOUNT_AGE,
  REFUND_DAYS,
  SELLER,
  SUPPORT_EMAIL,
  SUPPORT_MAILTO,
} from '../lib/legal/seller';
import { loadLandingDictionary } from './dictionaries';
import {
  HERO_DESKTOP_MEDIA,
  HERO_DESKTOP_SIZES,
  PHONE_SIZES,
  SHOTS,
  shotLang,
  shotSrc,
  shotSrcSet,
  type ShotId,
  type ShotLang,
} from './heroImages';
import {
  IconBook,
  IconBriefcase,
  IconCap,
  IconCheck,
  IconFolder,
  IconGlobe,
  IconLock,
  IconPalette,
  IconPhone,
  IconRepeat,
} from './icons';
import './landing.css';

export interface LandingPageProps {
  initialLocale: Locale;
  initialDictionary: Dictionary;
  /** "Start free": remember the visit and open the app. */
  onStart: () => void;
  /** Warm the app chunk when the visitor is about to press "Start free". */
  onPrefetchApp: () => void;
}

type T = (key: TKey, vars?: Vars) => string;

/* React 18 has no typed `fetchPriority` prop; the lowercase attribute passes through. */
const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>;

const BLANK_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const AUDIENCES: Array<{ id: 'pupils' | 'students' | 'pros'; icon: ReactNode }> = [
  { id: 'pupils', icon: <IconBook /> },
  { id: 'students', icon: <IconCap /> },
  { id: 'pros', icon: <IconBriefcase /> },
];

const SHOWCASE: Array<{ id: 'focus' | 'today' | 'growth'; shot: ShotId; alt: TKey }> = [
  { id: 'focus', shot: 'focus-phone', alt: 'land.shot.focusPhone.alt' },
  { id: 'today', shot: 'today-phone', alt: 'land.shot.today.alt' },
  { id: 'growth', shot: 'growth-phone', alt: 'land.shot.growth.alt' },
];

const TILES: Array<{ id: string; icon: ReactNode }> = [
  { id: 'projects', icon: <IconFolder /> },
  { id: 'habits', icon: <IconRepeat /> },
  { id: 'atm', icon: <IconPalette /> },
  { id: 'private', icon: <IconLock /> },
  { id: 'langs', icon: <IconGlobe /> },
  { id: 'install', icon: <IconPhone /> },
];

const FREE_FEATURES: readonly TKey[] = [...PLAN_FEATURE_KEYS.free, SYNC_SCOPE_KEY];
const PRO_FEATURES: readonly TKey[] = PLAN_FEATURE_KEYS.proMonthly;

const FAQ_IDS = [
  'free',
  'account',
  'data',
  'cancel',
  'refund',
  'minors',
  'devices',
  'offline',
  'ai',
  'support',
] as const;

function interp(template: string, vars?: Vars): string {
  if (!vars) return template;
  let out = template;
  for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

/** Renders `template` with its first `token` replaced by a React node. */
function withToken(template: string, token: string, node: ReactNode): ReactNode {
  const at = template.indexOf(token);
  if (at < 0) return template;
  return (
    <>
      {template.slice(0, at)}
      {node}
      {template.slice(at + token.length)}
    </>
  );
}

function setMeta(name: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (el) el.content = content;
}

/** Fades sections in as they scroll into view; everything stays visible when
 * the visitor prefers reduced motion or the browser lacks IntersectionObserver. */
function useReveal(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;
    el.dataset.reveal = 'on';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    el.querySelectorAll('.lnd-reveal').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

function Shot({
  lang,
  id,
  alt,
  sizes,
  eager = false,
}: {
  lang: ShotLang;
  id: ShotId;
  alt: string;
  sizes: string;
  eager?: boolean;
}) {
  const spec = SHOTS[id];
  return (
    <picture>
      <source type="image/avif" srcSet={shotSrcSet(lang, id, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={shotSrcSet(lang, id, 'webp')} sizes={sizes} />
      <img
        src={shotSrc(lang, id, spec.widths[spec.widths.length - 1], 'webp')}
        width={spec.width}
        height={spec.height}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        {...(eager ? HIGH_PRIORITY : {})}
      />
    </picture>
  );
}

function StartButton({
  t,
  onStart,
  onPrefetchApp,
  size = 'lg',
}: {
  t: T;
  onStart: () => void;
  onPrefetchApp: () => void;
  size?: 'lg' | 'sm';
}) {
  return (
    <button
      type="button"
      className={`lnd-btn lnd-btn-primary${size === 'sm' ? ' lnd-btn-sm' : ''}`}
      onClick={onStart}
      onPointerEnter={onPrefetchApp}
      onFocus={onPrefetchApp}
      onTouchStart={onPrefetchApp}
    >
      {t('land.cta.start')}
    </button>
  );
}

export default function LandingPage({
  initialLocale,
  initialDictionary,
  onStart,
  onPrefetchApp,
}: LandingPageProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [dict, setDict] = useState<Dictionary>(initialDictionary);
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const t: T = useCallback(
    (key, vars) => interp((dict as Record<string, string>)[key] ?? key, vars),
    [dict],
  );
  const lang = shotLang(locale);
  const tag = LOCALES.find((l) => l.id === locale)?.tag ?? 'en-US';

  useEffect(() => {
    document.documentElement.lang = tag;
    document.title = t('land.meta.title');
    setMeta('description', t('land.meta.desc'));
  }, [t, tag]);

  const changeLocale = async (next: string) => {
    if (!isLocale(next) || next === locale) return;
    saveLocale(next);
    const nextDict = await loadLandingDictionary(next);
    setDict(nextDict);
    setLocale(next);
  };

  const langSelect = (id: string) => (
    <label className="lnd-lang">
      <span className="lnd-sr">{t('land.lang')}</span>
      <IconGlobe />
      <select id={id} value={locale} onChange={(e) => void changeLocale(e.target.value)}>
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );

  const start = { t, onStart, onPrefetchApp };

  return (
    <div ref={rootRef} className="atm-root lnd" data-atmosphere="ritual">
      <header className="lnd-header">
        <div className="lnd-wrap lnd-header-in">
          <a className="lnd-brand" href="#top" aria-label={t('land.home')}>
            <img src="/landing/mark-64.webp" width={32} height={32} alt="" />
            <span>Moneo</span>
          </a>
          <nav className="lnd-nav" aria-label={t('land.nav.label')}>
            <a href="#for-whom">{t('land.nav.forWhom')}</a>
            <a href="#features">{t('land.nav.features')}</a>
            <a href="#pricing">{t('land.nav.pricing')}</a>
            <a href="#faq">{t('land.nav.faq')}</a>
          </nav>
          <div className="lnd-header-end">
            <Link className="lnd-signin" to="/login">
              {t('auth.signIn')}
            </Link>
            {langSelect('lnd-lang-top')}
            <StartButton {...start} size="sm" />
          </div>
        </div>
      </header>

      <main id="top">
        <section className="lnd-hero" aria-labelledby="lnd-hero-title">
          <div className="lnd-wrap lnd-hero-in">
            <div className="lnd-hero-copy">
              <p className="lnd-eyebrow">{t('land.hero.eyebrow')}</p>
              <h1 id="lnd-hero-title" className="lnd-h1">
                {t('land.hero.title')}
              </h1>
              <p className="lnd-lead">{t('land.hero.sub')}</p>
              <div className="lnd-ctas">
                <StartButton {...start} />
                <Link className="lnd-btn lnd-btn-ghost" to="/pricing">
                  {t('land.cta.pricing')}
                </Link>
              </div>
              <p className="lnd-trust">{t('land.hero.trust')}</p>
            </div>
            <div className="lnd-hero-visual">
              <div className="lnd-window">
                <div className="lnd-window-bar" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <picture>
                  <source media="(max-width: 767.98px)" srcSet={BLANK_PIXEL} />
                  <source
                    media={HERO_DESKTOP_MEDIA}
                    type="image/avif"
                    srcSet={shotSrcSet(lang, 'focus-desktop', 'avif')}
                    sizes={HERO_DESKTOP_SIZES}
                  />
                  <source
                    media={HERO_DESKTOP_MEDIA}
                    type="image/webp"
                    srcSet={shotSrcSet(lang, 'focus-desktop', 'webp')}
                    sizes={HERO_DESKTOP_SIZES}
                  />
                  <img
                    src={shotSrc(lang, 'focus-desktop', 1440, 'webp')}
                    width={SHOTS['focus-desktop'].width}
                    height={SHOTS['focus-desktop'].height}
                    alt={t('land.shot.focus.alt')}
                    decoding="async"
                    {...HIGH_PRIORITY}
                  />
                </picture>
              </div>
              <div className="lnd-phone lnd-hero-phone">
                <Shot
                  lang={lang}
                  id="focus-phone"
                  alt={t('land.shot.focusPhone.alt')}
                  sizes={PHONE_SIZES}
                  eager
                />
              </div>
            </div>
          </div>
        </section>

        <section id="for-whom" className="lnd-section" aria-labelledby="lnd-who-title">
          <div className="lnd-wrap">
            <header className="lnd-section-head lnd-reveal">
              <p className="lnd-eyebrow">{t('land.who.eyebrow')}</p>
              <h2 id="lnd-who-title" className="lnd-h2">
                {t('land.who.title')}
              </h2>
            </header>
            <ul className="lnd-grid-3">
              {AUDIENCES.map((a) => (
                <li key={a.id} className="lnd-card lnd-audience lnd-reveal">
                  <span className="lnd-icon">{a.icon}</span>
                  <h3 className="lnd-h3">{t(`land.who.${a.id}.t` as TKey)}</h3>
                  <p>{t(`land.who.${a.id}.b` as TKey)}</p>
                  <ul className="lnd-checks">
                    {(['l1', 'l2', 'l3'] as const).map((l) => (
                      <li key={l}>
                        <IconCheck />
                        <span>{t(`land.who.${a.id}.${l}` as TKey)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="lnd-section" aria-labelledby="lnd-feat-title">
          <div className="lnd-wrap">
            <header className="lnd-section-head lnd-reveal">
              <p className="lnd-eyebrow">{t('land.feat.eyebrow')}</p>
              <h2 id="lnd-feat-title" className="lnd-h2">
                {t('land.feat.title')}
              </h2>
            </header>
            <ul className="lnd-grid-3">
              {SHOWCASE.map((s) => (
                <li key={s.id} className="lnd-card lnd-showcase lnd-reveal">
                  <div className="lnd-showcase-shot">
                    <div className="lnd-phone">
                      <Shot lang={lang} id={s.shot} alt={t(s.alt)} sizes={PHONE_SIZES} />
                    </div>
                  </div>
                  <div className="lnd-showcase-copy">
                    <h3 className="lnd-h3">{t(`land.feat.${s.id}.t` as TKey)}</h3>
                    <p>{t(`land.feat.${s.id}.b` as TKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <ul className="lnd-tiles">
              {TILES.map((f) => (
                <li key={f.id} className="lnd-tile lnd-reveal">
                  <span className="lnd-icon lnd-icon-sm">{f.icon}</span>
                  <div>
                    <h3 className="lnd-h4">{t(`land.feat.${f.id}.t` as TKey)}</h3>
                    <p>{t(`land.feat.${f.id}.b` as TKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lnd-section" aria-labelledby="lnd-how-title">
          <div className="lnd-wrap">
            <header className="lnd-section-head lnd-reveal">
              <p className="lnd-eyebrow">{t('land.how.eyebrow')}</p>
              <h2 id="lnd-how-title" className="lnd-h2">
                {t('land.how.title')}
              </h2>
            </header>
            <ol className="lnd-steps">
              {(['s1', 's2', 's3'] as const).map((s, i) => (
                <li key={s} className="lnd-step lnd-reveal">
                  <span className="lnd-step-num" aria-hidden>
                    {i + 1}
                  </span>
                  <h3 className="lnd-h3">{t(`land.how.${s}.t` as TKey)}</h3>
                  <p>{t(`land.how.${s}.b` as TKey)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="lnd-section" aria-labelledby="lnd-price-title">
          <div className="lnd-wrap">
            <header className="lnd-section-head lnd-reveal">
              <p className="lnd-eyebrow">{t('land.price.eyebrow')}</p>
              <h2 id="lnd-price-title" className="lnd-h2">
                {t('land.price.title')}
              </h2>
            </header>
            <div className="lnd-plans">
              <article className="lnd-card lnd-plan lnd-reveal" aria-labelledby="lnd-plan-free">
                <h3 id="lnd-plan-free" className="lnd-h3">
                  {t('land.price.free.t')}
                </h3>
                <p className="lnd-price">
                  <span className="lnd-price-num">{FREE_PRICE}</span>
                </p>
                <p className="lnd-plan-sub">{t('land.price.free.sub')}</p>
                <ul className="lnd-checks">
                  {FREE_FEATURES.map((k) => (
                    <li key={k}>
                      <IconCheck />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
                <div className="lnd-plan-cta">
                  <StartButton {...start} />
                </div>
              </article>
              <article
                className="lnd-card lnd-plan lnd-plan-pro lnd-reveal"
                aria-labelledby="lnd-plan-pro"
              >
                <h3 id="lnd-plan-pro" className="lnd-h3">
                  {t('land.price.pro.t')}
                </h3>
                <p className="lnd-price">
                  <span className="lnd-price-num">{PRO_PRICES.monthly}</span>
                  <span className="lnd-price-per">{t('pay.perMonth')}</span>
                </p>
                <p className="lnd-plan-sub">
                  {t('land.price.pro.or', { price: PRO_PRICES.yearly })}
                  <br />
                  <span className="lnd-accent">
                    {t('pay.yearlyEquiv', {
                      price: PRO_PRICES.yearlyMonthly,
                      n: PRO_PRICES.monthsFree,
                    })}
                  </span>
                </p>
                <ul className="lnd-checks">
                  {PRO_FEATURES.map((k) => (
                    <li key={k}>
                      <IconCheck />
                      <span>{t(k)}</span>
                    </li>
                  ))}
                </ul>
                <div className="lnd-plan-cta">
                  <Link className="lnd-btn lnd-btn-light" to="/pricing">
                    {t('land.price.pro.cta')}
                  </Link>
                </div>
              </article>
            </div>
            <p className="lnd-note lnd-reveal">
              {t('land.price.note', { days: REFUND_DAYS })}{' '}
              <Link to={LEGAL_PATHS.refund}>{t('land.price.refundLink')}</Link>
            </p>
          </div>
        </section>

        <section id="faq" className="lnd-section" aria-labelledby="lnd-faq-title">
          <div className="lnd-wrap lnd-faq-wrap">
            <header className="lnd-section-head lnd-reveal">
              <p className="lnd-eyebrow">{t('land.faq.eyebrow')}</p>
              <h2 id="lnd-faq-title" className="lnd-h2">
                {t('land.faq.title')}
              </h2>
            </header>
            <div className="lnd-faq lnd-reveal">
              {FAQ_IDS.map((id) => (
                <details key={id} className="lnd-faq-item">
                  <summary>
                    <span>{t(`land.faq.${id}.q` as TKey)}</span>
                    <span className="lnd-faq-chev" aria-hidden />
                  </summary>
                  <div className="lnd-faq-a">
                    {id === 'support' ? (
                      <p>
                        {withToken(
                          t('land.faq.support.a'),
                          '{email}',
                          <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>,
                        )}
                      </p>
                    ) : (
                      <p>
                        {t(`land.faq.${id}.a` as TKey, {
                          days: REFUND_DAYS,
                          min: MIN_ACCOUNT_AGE,
                          adult: ADULT_AGE,
                          consent: DIGITAL_CONSENT_AGE,
                        })}
                      </p>
                    )}
                    {id === 'refund' && (
                      <p>
                        <Link to={LEGAL_PATHS.refund}>{t('land.price.refundLink')}</Link>
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lnd-section lnd-final-wrap" aria-labelledby="lnd-final-title">
          <div className="lnd-wrap">
            <div className="lnd-final lnd-reveal">
              <h2 id="lnd-final-title" className="lnd-h2">
                {t('land.final.title')}
              </h2>
              <p className="lnd-lead">{t('land.final.sub')}</p>
              <div className="lnd-ctas lnd-ctas-center">
                <StartButton {...start} />
                <Link className="lnd-btn lnd-btn-ghost" to="/pricing">
                  {t('land.cta.pricing')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lnd-footer">
        <div className="lnd-wrap lnd-footer-in">
          <div className="lnd-footer-brand">
            <span className="lnd-brand">
              <img src="/landing/mark-64.webp" width={28} height={28} alt="" loading="lazy" />
              <span>Moneo</span>
            </span>
            <p>{t('land.hero.title')}</p>
          </div>
          <nav className="lnd-footer-nav" aria-label={t('land.foot.nav')}>
            <Link to={LEGAL_PATHS.terms}>{t('foot.terms')}</Link>
            <Link to={LEGAL_PATHS.privacy}>{t('foot.privacy')}</Link>
            <Link to={LEGAL_PATHS.refund}>{t('foot.refund')}</Link>
            <a href={SUPPORT_MAILTO}>{t('foot.contact')}</a>
            <Link to="/help">{t('foot.help')}</Link>
            <Link to="/login">{t('auth.signIn')}</Link>
          </nav>
          <div className="lnd-footer-end">
            {langSelect('lnd-lang-foot')}
            <p className="lnd-seller">
              © {new Date().getFullYear()} Moneo — {SELLER.name}, {t('land.foot.country')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
