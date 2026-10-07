import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium select-none',
  {
    variants: {
      variant: {
        default: 'border-edge bg-surface text-foreground',
        outline: 'border-edge bg-transparent text-muted',
        secondary: 'border-edge/60 bg-surface text-muted',
        subtle: 'border-transparent bg-surface text-muted',
        contrast: 'border-transparent bg-foreground text-background',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
