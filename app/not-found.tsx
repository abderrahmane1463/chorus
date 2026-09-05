import Link from 'next/link';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The link may be wrong, or the event may have been removed.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/join">Join an event</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
