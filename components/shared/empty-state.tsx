import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
