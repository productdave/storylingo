export type SupportedLanguage = "en" | "zh" | "es";

export interface LanguageConfig {
  promptId: string;
  voice: string;
  languageInstruction: string;
  languageName: string;
}

const DEFAULT_PROMPT_ID = "pmpt_69a90d800bd48194b453b5797a6145350421cafc908bc7e5";

export const languageConfigs: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in English for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "English",
  },
  zh: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in Chinese (Mandarin) for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
    languageName: "Chinese (Mandarin)",
  },
  es: {
    promptId: DEFAULT_PROMPT_ID,
    voice: "alloy",
    languageInstruction: `IMPORTANT: This is an IMMERSIVE LANGUAGE LEARNING experience for children ages 3-10.
Speak ONLY in Spanish for this entire session - no translations or explanations in other languages.
Use very simple vocabulary and short sentences appropriate for toddlers.
Repeat key words naturally to help children learn them.
Speak slowly and clearly with enthusiasm.
Use lots of expression, sound effects, and encourage children to repeat words and phrases.`,
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
