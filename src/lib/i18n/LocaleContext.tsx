import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { createI18n, saveLocale, type Dictionary, type I18n, type Locale } from './index';

interface LocaleValue extends I18n {
  setLocale: (locale: Locale) => void;
}

const Ctx = createContext<LocaleValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  onLocaleChange,
  children,
}: {
  locale: Locale;
  dictionary?: Dictionary;
  onLocaleChange: (locale: Locale) => void;
  children: ReactNode;
}) {
  const value = useMemo<LocaleValue>(() => {
    const i18n = createI18n(locale, dictionary);
    return {
      ...i18n,
      setLocale: (next: Locale) => {
        saveLocale(next);
        onLocaleChange(next);
      },
    };
  }, [locale, dictionary, onLocaleChange]);

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
