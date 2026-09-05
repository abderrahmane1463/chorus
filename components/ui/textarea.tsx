import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm',
        'placeholder:text-muted-foreground',
        'focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
