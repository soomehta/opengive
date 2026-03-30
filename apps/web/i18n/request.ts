import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from './locales';

export default getRequestConfig(async () => {
  // Resolve locale from cookie, falling back to the default.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;

  const locale: SupportedLocale =
    cookieLocale != null &&
    SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)
      ? (cookieLocale as SupportedLocale)
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
