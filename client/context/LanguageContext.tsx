import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import enTranslations from "@/locales/en.json";
import zhTranslations from "@/locales/zh.json";
import esTranslations from "@/locales/es.json";

export type Language = "en" | "zh" | "es";

export type TranslationType = typeof enTranslations;

const translations: Record<Language, TranslationType> = {
  en: enTranslations,
  zh: zhTranslations,
  es: esTranslations,
};

const LANGUAGE_STORAGE_KEY = "@storylingo_language";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationType;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredLanguage();
  }, []);

  const loadStoredLanguage = async () => {
    try {
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage && (storedLanguage === "en" || storedLanguage === "zh" || storedLanguage === "es")) {
        setLanguageState(storedLanguage as Language);
      }
    } catch (error) {
      console.error("Failed to load stored language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Failed to save language preference:", error);
      setLanguageState(lang);
    }
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}

export function getStoryTranslation(t: TranslationType, storyId: string) {
  return t.stories[storyId as keyof typeof t.stories];
}
