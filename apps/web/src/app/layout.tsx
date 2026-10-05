import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenTrack — Developer-First Product Analytics',
  description: 'Open-source, developer-first product analytics platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={dark}>
      <html lang="en" className="dark">
        <body className="antialiased bg-zinc-950 text-zinc-100 min-h-screen selection:bg-zinc-800 selection:text-zinc-100">
          {children}
          <Toaster position="bottom-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
