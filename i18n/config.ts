/**
 * Language settings, kept free of server imports so client components can read
 * them too.
 *
 * The locale lives in a cookie rather than the URL: join links and the QR code
 * printed on the presenter screen must stay the same for every participant,
 * whatever language each of them reads in.
 */
export const locales = ['en', 'fr', 'ar'] as const;

export type Locale = (typeof locales)[number];

/** Used when the browser asks for a language Chorus does not have. */
export const defaultLocale: Locale = 'fr';

export const LOCALE_COOKIE = 'chorus_locale';

/** A year: the choice is a preference, not a session. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  fr: 'ltr',
  ar: 'rtl',
};

/** Each language named in itself, which is what a reader looking for it expects. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
