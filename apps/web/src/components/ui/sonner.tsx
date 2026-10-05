'use client';

import { useTheme } from 'next-themes';
import { Toaster as RadixToaster } from 'sonner';

type ToasterProps = React.ComponentProps<typeof RadixToaster>;

export function Toaster({ ...props }: ToasterProps) {
  const { theme = 'dark' } = useTheme();

  return (
    <RadixToaster
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-zinc-100 group-[.toaster]:border-zinc-800 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans',
          description: 'group-[.toast]:text-zinc-400',
          actionButton:
            'group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-900 group-[.toast]:active:scale-[0.97]',
          cancelButton:
            'group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 group-[.toast]:active:scale-[0.97]',
        },
      }}
      {...props}
    />
  );
}
