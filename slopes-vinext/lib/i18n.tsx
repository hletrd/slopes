"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SupportedLanguage, TranslationData } from "@/lib/types";
import koTranslations from "@/public/lang/ko.json";
import enTranslations from "@/public/lang/en.json";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "ko"];
export const DEFAULT_LANGUAGE: SupportedLanguage = "ko";
export const STORAGE_KEY = "webcamLanguage";

const TRANSLATIONS: Record<SupportedLanguage, TranslationData> = {
  ko: koTranslations as TranslationData,
  en: enTranslations as TranslationData,
};

interface I18nContextValue {
  t: (key: string, params?: Record<string, string | number>) => string;
  getResortName: (resortId: string, defaultName: string) => string;
  getWebcamName: (resortId: string, webcamIndex: number, defaultName: string) => string;
  getWeatherLocationName: (name: string) => string;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  getSupportedLanguages: () => SupportedLanguage[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function getPreferredLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && (SUPPORTED_LANGUAGES as string[]).includes(saved)) {
    return saved as SupportedLanguage;
  }

  const browserLang = navigator.language;
  if (browserLang && browserLang.toLowerCase().startsWith("ko")) {
    return "ko";
  }

  return "en";
}

function getTranslations(lang: SupportedLanguage): TranslationData {
  return TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
}

function resolveKey(
  translations: TranslationData,
  key: string,
  params: Record<string, string | number> = {}
): string {
  const keys = key.split(".");
  let value: string | TranslationData = translations;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = (value as TranslationData)[k];
    } else {
      console.warn(`Translation not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== "string") {
    console.warn(`Translation is not a string: ${key}`);
    return key;
  }

  return value.replace(/\{(\w+)\}/g, (_match, paramName: string) => {
    const v = params[paramName];
    return v !== undefined ? String(v) : `{${paramName}}`;
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [translations, setTranslations] = useState<TranslationData>(
    getTranslations(DEFAULT_LANGUAGE)
  );

  useEffect(() => {
    const preferred = getPreferredLanguage();
    setLanguageState(preferred);
    setTranslations(getTranslations(preferred));
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (!(SUPPORTED_LANGUAGES as string[]).includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }

    setTranslations(getTranslations(lang));
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, []);

  // Update html lang on mount
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      resolveKey(translations, key, params),
    [translations]
  );

  const getResortName = useCallback(
    (resortId: string, defaultName: string): string => {
      const key = `resorts.${resortId}.name`;
      const result = resolveKey(translations, key);
      return result === key ? defaultName : result;
    },
    [translations]
  );

  const getWebcamName = useCallback(
    (resortId: string, webcamIndex: number, defaultName: string): string => {
      const key = `resorts.${resortId}.webcams.${webcamIndex}`;
      const result = resolveKey(translations, key);
      return result === key ? defaultName : result;
    },
    [translations]
  );

  const getWeatherLocationName = useCallback(
    (name: string): string => {
      const key = `weatherLocations.${name}`;
      const result = resolveKey(translations, key);
      return result === key ? name : result;
    },
    [translations]
  );

  const getSupportedLanguages = useCallback(
    () => [...SUPPORTED_LANGUAGES],
    []
  );

  const value: I18nContextValue = {
    t,
    getResortName,
    getWebcamName,
    getWeatherLocationName,
    language,
    setLanguage,
    getSupportedLanguages,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
