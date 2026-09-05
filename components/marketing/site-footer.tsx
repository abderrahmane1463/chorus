import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Live polls, Q&amp;A and quizzes for meetings, classes and conferences.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="#product" className="hover:text-foreground">Product</a>
          <a href="#use-cases" className="hover:text-foreground">Use cases</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <Link href="/join" className="hover:text-foreground">Join an event</Link>
          <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
        </nav>
      </div>
      <div className="border-t border-border px-5 py-4">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} Chorus
        </p>
      </div>
    </footer>
  );
}
