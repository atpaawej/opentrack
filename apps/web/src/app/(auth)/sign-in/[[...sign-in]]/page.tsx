import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Subtle radial ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-zinc-100 hover:text-white transition-colors group"
        >
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 shadow-sm group-hover:border-zinc-700 transition-colors">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="font-semibold tracking-tight text-lg">OpenTrack</span>
        </Link>

        <SignIn />
      </div>
    </div>
  );
}
