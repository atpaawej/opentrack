import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-background px-4 py-10 text-foreground">
      <Link href="/" className="flex items-center gap-2.5 rounded-sm text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-xs font-bold text-background">OT</span>
        OpenTrack
      </Link>
      <SignIn />
    </main>
  );
}
