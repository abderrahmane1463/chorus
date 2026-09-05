import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shared/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8" aria-label="Chorus home">
        <Logo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
