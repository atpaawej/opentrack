'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay ref={ref} className={cn('ui-overlay fixed inset-0 z-50 bg-background/80', className)} {...props} />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'ui-sheet-content fixed z-50 flex flex-col gap-4 overflow-y-auto overscroll-contain bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-foreground shadow-2xl focus:outline-none',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 max-h-dvh border-b border-edge',
        bottom: 'inset-x-0 bottom-0 max-h-dvh border-t border-edge',
        left: 'inset-y-0 left-0 h-dvh w-3/4 border-r border-edge sm:max-w-md',
        right: 'inset-y-0 right-0 h-dvh w-full border-l border-edge sm:w-3/4 sm:max-w-xl md:max-w-2xl',
      },
    },
    defaultVariants: { side: 'right' },
  }
);

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      data-side={side}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-3 top-[calc(.75rem+env(safe-area-inset-top,0px))] flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-edge/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:pointer-events-none">
        <X aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

export const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);
SheetFooter.displayName = 'SheetFooter';

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn('pr-8 text-lg font-semibold text-foreground', className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;
