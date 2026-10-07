'use client';

import { Toaster as SonnerToaster } from 'sonner';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      className="toaster group"
      toastOptions={{
        style: {
          background: 'var(--surface)',
          color: 'var(--foreground)',
          borderColor: 'var(--edge)',
          fontFamily: 'var(--font-plex-sans), system-ui, sans-serif',
        },
        classNames: {
          toast: 'rounded-lg shadow-2xl',
          description: '!text-muted',
          actionButton: '!bg-foreground !text-background',
          cancelButton: '!bg-edge !text-foreground',
        },
      }}
      {...props}
    />
  );
}
