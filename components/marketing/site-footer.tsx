import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/shared/logo';

export async function SiteFooter() {
  const t = await getTranslations('nav');
  const tFooter = await getTranslations('footer');

  const links = [
    { href: '/#product', label: t('product') },
    { href: '/#use-cases', label: t('useCases') },
    { href: '/#pricing', label: t('pricing') },
    { href: '/join', label: t('join') },
    { href: '/sign-in', label: t('signIn') },
    { href: '/privacy', label: t('privacy') },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {tFooter('tagline')}
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border px-5 py-4">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          {/* A string, not a number: a year must not be grouped as "2,026". */}
          {tFooter('copyright', { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
}
