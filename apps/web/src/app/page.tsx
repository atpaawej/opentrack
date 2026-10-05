import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { listUserProjects } from '@/features/projects/service';
import { CreateFirstProject } from '@/components/dashboard/create-first-project';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const { userId, orgId } = await auth();

  if (userId) {
    const exit = await Effect.runPromiseExit(
      listUserProjects({ clerkUserId: userId, clerkOrgId: orgId })
    );

    if (Exit.isSuccess(exit) && exit.value.length > 0) {
      redirect(`/${exit.value[0].slug}`);
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#09090b] text-zinc-100">
        <CreateFirstProject />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Navigation bar */}
      <header className="border-b border-zinc-800/60 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-zinc-100 text-zinc-950 flex items-center justify-center font-mono font-bold text-xs">
              OT
            </div>
            <span className="font-semibold text-sm tracking-tight">OpenTrack</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-xs text-zinc-400 hover:text-white">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild className="text-xs font-medium">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 font-mono mb-8">
          Self-hostable &bull; Sub-5ms Ingestion &bull; TypeScript Native
        </div>

        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.15]">
          Developer-first product analytics without the bloat.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
          Open-source event ingestion, real-time streaming, and user funnels. Built on Neon Postgres and Effect-TS.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button size="default" asChild className="font-medium">
            <Link href="/sign-up">Start tracking free</Link>
          </Button>

          <Button size="default" variant="outline" asChild className="border-zinc-800 text-zinc-300 hover:text-white">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>

        {/* Minimal architectural overview */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-800/80 rounded-lg overflow-hidden border border-zinc-800 text-left w-full">
          <div className="bg-[#0c0c0e] p-5 space-y-1.5">
            <div className="text-xs font-mono text-zinc-400">01 / INGESTION</div>
            <div className="text-sm font-semibold text-zinc-200">Sub-5ms Pipeline</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Neon connection pool with typed Effect-TS validation.
            </p>
          </div>

          <div className="bg-[#0c0c0e] p-5 space-y-1.5">
            <div className="text-xs font-mono text-zinc-400">02 / REAL-TIME</div>
            <div className="text-sm font-semibold text-zinc-200">Live SSE Stream</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Direct telemetry inspection as client events arrive.
            </p>
          </div>

          <div className="bg-[#0c0c0e] p-5 space-y-1.5">
            <div className="text-xs font-mono text-zinc-400">03 / SECURITY</div>
            <div className="text-sm font-semibold text-zinc-200">CORS & IP Anonymity</div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              SHA-256 salted IP hashes and scoped origin checks.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600 font-mono">
        OpenTrack &bull; Apache-2.0
      </footer>
    </div>
  );
}
