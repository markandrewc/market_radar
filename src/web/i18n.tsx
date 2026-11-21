import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const languages = [
  { id: 'de', name: 'Deutsch', locale: 'de-CH', direction: 'ltr' },
  { id: 'en', name: 'English', locale: 'en-GB', direction: 'ltr' },
  { id: 'fr', name: 'Français', locale: 'fr-CH', direction: 'ltr' },
  { id: 'it', name: 'Italiano', locale: 'it-CH', direction: 'ltr' },
  { id: 'uk', name: 'Українська', locale: 'uk-UA', direction: 'ltr' },
  { id: 'ar', name: 'العربية', locale: 'ar', direction: 'rtl' },
] as const;

export type Language = typeof languages[number]['id'];
export type LocalizedText = readonly [de: string, en: string, fr: string, it: string, uk: string, ar: string];
type Translate = (...copy: LocalizedText) => string;
type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: Translate;
};

const storageKey = 'market-radar:language';
const LanguageContext = createContext<LanguageContextValue | null>(null);

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    return languages.find((option) => option.id === saved)?.id ?? 'de';
  } catch {
    return 'de';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);
  const option = languages.find((entry) => entry.id === language) ?? languages[0];

  useEffect(() => {
    document.documentElement.lang = option.locale;
    document.documentElement.dir = option.direction;
    try {
      localStorage.setItem(storageKey, option.id);
    } catch {
      // Keep the current choice if browser storage is unavailable.
    }
  }, [option]);

  const t: Translate = (de, en, fr, it, uk, ar) => ({ de, en, fr, it, uk, ar })[language];
  return (
    <LanguageContext.Provider value={{ language, locale: option.locale, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required');
  return context;
}
