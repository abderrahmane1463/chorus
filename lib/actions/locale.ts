'use server';

import { cookies } from 'next/headers';
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from '@/i18n/config';

/**
 * Stores the reader's language choice.
 *
 * Not httpOnly: it holds a preference, not an identity, and keeping it
 * readable lets the client avoid a round trip to know what is selected.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    sameSite: 'lax',
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
}
