import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/shared/logo';
import { PoweredBy } from '@/components/shared/powered-by';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('notFound');

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t('body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/join">{t('join')}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
      <PoweredBy className="mt-12" />
    </div>
  );
}
