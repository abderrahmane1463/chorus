import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

/**
 * "Powered by" and Sense Conseil's logo, cut from their own file: dark
 * letters on light surfaces, light letters on dark ones, the red dot as is.
 */
export function PoweredBy({ className, tone }: { className?: string; tone?: 'light' | 'dark' }) {
  const t = useTranslations('brand');
  const logo = 'h-full w-auto';

  return (
    <span dir="ltr" className={cn('inline-flex h-3 shrink-0 items-center gap-1.5 whitespace-nowrap', className)}>
      <span className="text-[0.625rem] font-medium uppercase leading-none tracking-[0.12em] text-muted-foreground">
        {t('poweredBy')}
      </span>
      {tone !== 'dark' && (
        <Image
          src="/brand/sense-on-light.png"
          alt="Sense Conseil"
          width={787}
          height={149}
          sizes="128px"
          className={cn(logo, tone === undefined && 'dark:hidden')}
        />
      )}
      {tone !== 'light' && (
        <Image
          src="/brand/sense-on-dark.png"
          alt="Sense Conseil"
          width={787}
          height={149}
          sizes="128px"
          className={cn(logo, tone === undefined && 'hidden dark:block')}
        />
      )}
    </span>
  );
}
