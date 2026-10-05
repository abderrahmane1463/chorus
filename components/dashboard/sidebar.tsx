'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { BarChart3, CalendarDays, LayoutDashboard, Menu, Settings, X } from 'lucide-react';
import { Logo } from '@/components/shared/logo';
import { cn } from '@/lib/utils/cn';
import { UserMenu } from './user-menu';

const navigation = [
  { href: '/dashboard', key: 'overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/events', key: 'events', icon: CalendarDays, exact: false },
  { href: '/dashboard/analytics', key: 'analytics', icon: BarChart3, exact: false },
  { href: '/settings', key: 'settings', icon: Settings, exact: false },
] as const;

type User = { name?: string | null; email?: string | null; image?: string | null };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations('dash');

  return (
    <nav className="flex flex-col gap-1">
      {navigation.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-subtle text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardSidebar({ user }: { user: User }) {
  const t = useTranslations('dash');
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar. The sidebar becomes a sheet below the lg breakpoint. */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 hover:bg-muted"
          aria-label={t('openNav')}
        >
          <Menu className="size-5" />
        </button>
        <Link href="/dashboard" aria-label={t('dashboardHome')}>
          <Logo />
        </Link>
        <div className="ms-auto min-w-0">
          <UserMenu user={user} />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 flex w-64 flex-col border-e border-border bg-card p-4">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label={t('closeNav')}
              >
                <X className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 flex-col border-e border-border bg-card p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 px-1" aria-label={t('dashboardHome')}>
          <Logo />
        </Link>
        <NavLinks />
        <div className="mt-auto">
          <UserMenu user={user} />
        </div>
      </aside>
    </>
  );
}
