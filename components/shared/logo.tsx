import { cn } from '@/lib/utils/cn';

/**
 * The Chorus mark: four rising bars, like several voices answering at once.
 * The tallest bar carries the accent colour so the mark reads at 16px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={cn('size-7', className)}
    >
      <rect x="2" y="14" width="4.5" height="10" rx="2.25" fill="currentColor" opacity="0.45" />
      <rect x="8.75" y="9" width="4.5" height="15" rx="2.25" fill="currentColor" opacity="0.7" />
      <rect x="15.5" y="4" width="4.5" height="20" rx="2.25" fill="var(--accent)" />
      <rect x="22.25" y="11" width="4.5" height="13" rx="2.25" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-primary', className)}>
      <LogoMark />
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Chorus
        </span>
      )}
    </span>
  );
}
