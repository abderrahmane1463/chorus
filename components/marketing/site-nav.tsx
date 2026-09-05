'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/theme-toggle';

const links = [
  { href: '#product', label: 'Product' },
  { href: '#use-cases', label: 'Use cases' },
  { href: '#pricing', label: 'Pricing' },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" aria-label="Chorus home">
          <Logo />
        </Link>

        <ul className="hidden gap-6 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Get started free</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto rounded-md p-2 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
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
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block text-sm text-muted-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="secondary" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
