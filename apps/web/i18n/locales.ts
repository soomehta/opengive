export const SUPPORTED_LOCALES = ['en', 'ar', 'hi', 'fr', 'es', 'de'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const RTL_LOCALES: SupportedLocale[] = ['ar'];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  ar: 'العربية',
  hi: 'हिन्दी',
  fr: 'Français',
  es: 'Español',
  de: 'Deutsch',
};
