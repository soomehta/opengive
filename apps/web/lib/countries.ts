/**
 * Country code utility helpers.
 *
 * These are shared across Server Components and Client Components.
 * Keep this file free of any server-only imports.
 */

/**
 * Converts an ISO 3166-1 alpha-2 country code to a flag emoji.
 *
 * Each letter is mapped to a Unicode Regional Indicator Symbol Letter
 * (U+1F1E6–U+1F1FF). Pairs of these symbols render as a flag in most
 * modern environments.
 *
 * Returns a globe emoji (🌐) when the code is not exactly 2 characters.
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  const points = [...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

/**
 * Converts an ISO 3166-1 alpha-2 country code to a human-readable name
 * using the `Intl.DisplayNames` API.
 *
 * Falls back to the raw code string when the runtime does not support
 * `Intl.DisplayNames` or when the code has no known mapping.
 *
 * @param code   Two-letter ISO country code (case-insensitive).
 * @param locale BCP 47 locale tag for the display name language. Defaults to 'en'.
 */
export function countryCodeToName(code: string, locale = 'en'): string {
  if (!code) return '';
  try {
    return (
      new Intl.DisplayNames([locale], { type: 'region' }).of(
        code.toUpperCase(),
      ) ?? code
    );
  } catch {
    return code;
  }
}
