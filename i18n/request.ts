import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, locales, LOCALE_COOKIE, type Locale } from './config';

/**
 * Best match from an Accept-Language header.
 *
 * Only the base tag matters here: `fr-DZ`, `fr-FR` and `fr` are all French as
 * far as Chorus is concerned. Entries are ranked by their q value, which is
 * how browsers express "Arabic, but English will do".
 */
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((parameter) => parameter.startsWith('q='));
      return {
        base: tag.split('-')[0]?.toLowerCase() ?? '',
        quality: quality ? Number.parseFloat(quality.slice(2)) : 1,
      };
    })
    .filter((entry) => Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  return ranked.find((entry) => isLocale(entry.base))?.base as Locale | undefined ?? null;
}

/** An explicit choice always wins; the browser's preference is only a guess. */
export async function resolveLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  return fromAcceptLanguage((await headers()).get('accept-language')) ?? defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export { locales };
