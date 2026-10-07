import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium select-none transition-[background-color,color,border-color,transform] duration-150 ease-ease-out-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] disabled:active:scale-100',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80',
        destructive: 'bg-error text-background hover:bg-error/90 active:bg-error/80',
        outline: 'border border-edge bg-transparent text-foreground hover:bg-surface active:bg-surface/80',
        secondary: 'bg-surface text-foreground hover:bg-edge/70 active:bg-edge/60',
        ghost: 'text-muted hover:bg-surface hover:text-foreground active:bg-edge/50',
        link: 'text-signal underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'min-h-10 px-4 py-2',
        sm: 'min-h-9 rounded-md px-3 text-xs',
        lg: 'min-h-11 rounded-md px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** For forward/navigation actions only. The icon is decorative and never names the action. */
  trailingArrow?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, trailingArrow = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const showArrow = trailingArrow && size !== 'icon' && !props.disabled && !props['aria-busy'];

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), showArrow && 'ui-button-arrow group')}
        ref={ref}
        {...props}
      >
        {asChild ? <Slottable>{children}</Slottable> : children}
        {showArrow && (
          <span aria-hidden="true" className="ui-arrow-icon relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="ui-arrow-stem absolute left-[2px] top-1/2 h-px w-[9px] origin-right -translate-y-1/2 scale-x-0 bg-current opacity-0" />
            <span className="ui-arrow-chevron absolute right-[2px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rotate-45 border-r border-t border-current" />
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
