'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { LanguageSwitcher } from '@/components/shared/language-switcher';

// Rooted at "/" so the menu still works from pages other than the homepage.
const links = [
  { href: '/#product', key: 'product' },
  { href: '/#use-cases', key: 'useCases' },
  { href: '/#pricing', key: 'pricing' },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label={t('home')}>
          <Logo />
        </Link>

        <ul className="hidden gap-6 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>

        {/* Logical spacing, so the group sits on the correct side in Arabic. */}
        <div className="ms-auto hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">{t('signIn')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">{t('getStarted')}</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ms-auto rounded-md p-2 md:hidden"
          aria-label={t('menu')}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <ul className="space-y-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block text-sm text-muted-foreground"
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" asChild>
              <Link href="/sign-in">{t('signIn')}</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">{t('getStarted')}</Link>
            </Button>
            <div className="flex items-center justify-between pt-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
