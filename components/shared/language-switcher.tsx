'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { setLocale } from '@/lib/actions/locale';
import { locales, localeNames, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const t = useTranslations('language');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      // The language lives in a cookie, so nothing in the URL changes and
      // Next would otherwise serve the page it already has.
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-2', className)}
          aria-label={t('change')}
          loading={pending}
        >
          <Globe aria-hidden />
          <span>{localeNames[current]}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onSelect={() => choose(locale)}
            // No per-item dir: the browser already lays Arabic text out right
            // to left, and forcing direction pushed that one row to the
            // opposite edge of the menu from the others.
            className="justify-between gap-6"
          >
            <span>{localeNames[locale]}</span>
            {locale === current && <Check className="size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
