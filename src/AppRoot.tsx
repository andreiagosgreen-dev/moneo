/* The full app, loaded on demand so the public landing page stays light.
 * main.tsx only loads the faces the landing renders (Inter 400/600, Literata
 * 600); core app weights (Inter, Literata, Cal Sans, JetBrains Mono) ship here,
 * while the 11 extra Pro font packs load lazily via src/lib/proFontLoader.ts
 * only when selected by an active Pro user. */
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/literata/400.css';
import '@fontsource/literata/500.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/cal-sans/400.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import App from './App';
import { AuthProvider } from './lib/authProvider';
import type { Dictionary, Locale } from './lib/i18n';

export default function AppRoot({
  initialLocale,
  initialDictionary,
}: {
  initialLocale: Locale;
  initialDictionary: Dictionary;
}) {
  return (
    <AuthProvider>
      <App initialLocale={initialLocale} initialDictionary={initialDictionary} />
    </AuthProvider>
  );
}
