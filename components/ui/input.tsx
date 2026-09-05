import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
