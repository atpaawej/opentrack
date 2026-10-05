import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors select-none font-mono tracking-tight',
  {
    variants: {
      variant: {
        default: 'border-zinc-800 bg-zinc-900/80 text-zinc-200',
        outline: 'border-zinc-800 bg-transparent text-zinc-400',
        secondary: 'border-zinc-850 bg-zinc-900/40 text-zinc-400',
        subtle: 'border-transparent bg-zinc-900/60 text-zinc-400',
        contrast: 'border-transparent bg-zinc-200 text-zinc-950 font-medium',
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
