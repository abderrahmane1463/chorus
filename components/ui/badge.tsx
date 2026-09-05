import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        primary: 'bg-primary-subtle text-primary',
        accent: 'bg-accent-subtle text-accent',
        success: 'bg-success-subtle text-success',
        destructive: 'bg-destructive-subtle text-destructive',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
