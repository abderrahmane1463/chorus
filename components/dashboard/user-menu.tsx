'use client';

import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { signOutAction } from '@/lib/actions/session';

type UserLike = { name?: string | null; email?: string | null; image?: string | null };

function initials(user: UserLike): string {
  const source = user.name?.trim() || user.email || '?';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function UserMenu({ user }: { user: UserLike }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
          {initials(user)}
        </span>
        <span className="min-w-0 flex-1 lg:block">
          <span className="block truncate text-sm font-medium">
            {user.name ?? 'Host'}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Signed in as {user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <User />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none hover:bg-muted"
          >
            <LogOut className="size-4 text-muted-foreground" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
