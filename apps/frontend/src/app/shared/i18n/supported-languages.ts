/**
 * Canonical list of languages supported by the AI multilingual quiz sync
 * feature. Mirrored from the backend at
 * `apps/backend/src/shared/constants/supported-languages.ts` — keep in sync
 * (the backend validates user input against its copy; this drives the UI).
 *
 * Codes are BCP-47 (or close approximations) suitable for AI prompting.
 * The first entry (`en`) is the platform default and is NOT a valid target
 * for translation (translating English → English is a no-op). The frontend
 * filters it out of the translation target picker.
 */
export interface SupportedLanguage {
  /** BCP-47 language tag (e.g. `en`, `es`, `zh-CN`). */
  readonly code: string;
  /** Human-readable English name, used in UI labels and AI prompts. */
  readonly name: string;
  /** Unicode flag emoji for visual cues. */
  readonly flag: string;
  /** Native-script name, used to make UI labels feel local. */
  readonly nativeName: string;
}

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳', nativeName: '简体中文' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪', nativeName: 'Svenska' },
  { code: 'el', name: 'Greek', flag: '🇬🇷', nativeName: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱', nativeName: 'עברית' },
  { code: 'th', name: 'Thai', flag: '🇹🇭', nativeName: 'ไทย' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
] as const;

/** Languages available as translation targets (everything except the default English). */
export const TRANSLATABLE_LANGUAGES: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES.filter(
  (l) => l.code !== 'en'
);
