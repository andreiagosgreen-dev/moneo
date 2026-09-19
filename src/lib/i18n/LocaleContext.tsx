import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createI18n, preloadLocale, saveLocale, type I18n, type Locale } from './index';

interface LocaleValue extends I18n {
  setLocale: (locale: Locale) => void;
}

const Ctx = createContext<LocaleValue | null>(null);

export function LocaleProvider({
  locale,
  onLocaleChange,
  children,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  children: ReactNode;
}) {
  const value = useMemo<LocaleValue>(() => {
    const i18n = createI18n(locale);
    return {
      ...i18n,
      setLocale: (next: Locale) => {
        void preloadLocale(next).finally(() => {
          saveLocale(next);
          onLocaleChange(next);
        });
      },
    };
  }, [locale, onLocaleChange]);

  useEffect(() => {
    document.documentElement.lang = value.tag;
  }, [value.tag]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): LocaleValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <LocaleProvider>');
  return v;
}
