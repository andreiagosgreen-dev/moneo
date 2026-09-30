import { StrictMode, Suspense, lazy, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import './index.css';
import './mono/tokens.css';
import './mono/mono.css';
/* Only the faces the landing renders (Fontsource, bundled locally — offline +
 * PWA safe); vite.config.js preloads two of them. Every other weight and
 * family ships with the app chunk (AppRoot.tsx). */
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/literata/600.css';
import AppErrorBoundary from './components/AppErrorBoundary';
import { initErrorReporting } from './lib/errorReporting';
import {
  LANDING_PATH,
  isFirstVisitLanding,
  isLandingActiveInTab,
  landingView,
  markLandingActive,
  markLandingSeen,
  readStorageKeys,
  type LandingView,
} from './lib/landing';
import { loadLocale } from './lib/i18n/meta';
import { applyAtmosphere, loadAtmosphere } from './mono/atmosphere';
import { loadLandingDictionary } from './landing/dictionaries';
import { preloadLandingHero } from './landing/heroImages';
import type { LandingPageProps } from './landing/LandingPage';

/* Apply stored atmosphere before first paint so theme fonts hit body/Tailwind. */
applyAtmosphere(loadAtmosphere());
initErrorReporting();

const loadApp = () => import('./AppRoot');
const AppRoot = lazy(async () => {
  const locale = loadLocale();
  const [mod, i18n] = await Promise.all([loadApp(), import('./lib/i18n')]);
  const dictionary = await i18n.loadDictionary(locale);
  const Root = mod.default;
  return {
    default: () => <Root initialLocale={locale} initialDictionary={dictionary} />,
  };
});

const Landing = lazy(async () => {
  const locale = loadLocale();
  preloadLandingHero(locale);
  const [mod, dictionary] = await Promise.all([
    import('./landing/LandingPage'),
    loadLandingDictionary(locale),
  ]);
  const Page = mod.default;
  return {
    default: (props: Omit<LandingPageProps, 'initialLocale' | 'initialDictionary'>) => (
      <Page {...props} initialLocale={locale} initialDictionary={dictionary} />
    ),
  };
});

function prefetchApp() {
  void loadApp();
}

function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const onLanding = location.pathname.replace(/\/+$/, '') === LANDING_PATH;
  let view: LandingView = 'app';
  if (!started || onLanding) {
    const input = {
      pathname: location.pathname,
      search: location.search,
      storageKeys: readStorageKeys(),
      activeInTab: isLandingActiveInTab(),
    };
    view = landingView(input);
    if (isFirstVisitLanding(input)) markLandingActive(true);
  }

  const startApp = useCallback(() => {
    markLandingSeen();
    markLandingActive(false);
    setStarted(true);
    window.scrollTo(0, 0);
    if (onLanding) navigate('/');
  }, [navigate, onLanding]);

  return (
    <Suspense fallback={null}>
      {view === 'landing' ? (
        <Landing onStart={startApp} onPrefetchApp={prefetchApp} />
      ) : (
        <AppRoot />
      )}
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
