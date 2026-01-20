export type SupportedLanguage = "en" | "zh" | "es";

export interface LanguageConfig {
  promptId: string;
  voice: string;
  languageInstruction: string;
  languageName: string;
}

const DEFAULT_PROMPT_ID = "pmpt_696e819d09748196a4517a7b3e42c4560613f6be24ce5faa";

export const languageConfigs: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: "IMPORTANT: Speak only in English for this entire session. All responses, greetings, questions, and story narration must be in English.",
    languageName: "English",
  },
  zh: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: "IMPORTANT: Speak only in Chinese (Mandarin) for this entire session. All responses, greetings, questions, and story narration must be in Chinese.",
    languageName: "Chinese (Mandarin)",
  },
  es: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: "IMPORTANT: Speak only in Spanish for this entire session. All responses, greetings, questions, and story narration must be in Spanish.",
    languageName: "Spanish",
  },
};

export function getLanguageConfig(language: string): LanguageConfig {
  if (language in languageConfigs) {
    return languageConfigs[language as SupportedLanguage];
  }
  return languageConfigs.en;
}

export function isValidLanguage(language: string): language is SupportedLanguage {
  return language in languageConfigs;
}
