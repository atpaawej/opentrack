import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200',
        secondary:
          'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800',
        destructive:
          'border-red-900/40 bg-red-950/40 text-red-400 hover:bg-red-900/50',
        outline: 'border-zinc-700/80 text-zinc-300',
        success:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
        live:
          'border-emerald-500/30 bg-emerald-950/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
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
