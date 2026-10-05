import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { Effect, Exit } from 'effect';
import { listUserProjects } from '@/features/projects/service';
import { CreateFirstProject } from '@/components/dashboard/create-first-project';
import { Button } from '@/components/ui/button';
import { Activity, ArrowRight, ShieldCheck, Zap, BarChart2, Radio } from 'lucide-react';

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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950 text-zinc-100 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <CreateFirstProject />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-base">OpenTrack</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link href="/sign-up">
                <span>Get Started</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-medium text-emerald-400 mb-8 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Open Source &bull; Developer-First Telemetry
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.1]">
          Product analytics built for developers who ship fast.
        </h1>

        <p className="mt-6 text-lg text-zinc-400 max-w-2xl leading-relaxed">
          High-performance event ingestion, real-time streaming, and privacy-preserving insights with zero bloat. Embed a single tag or use the type-safe SDK.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild className="gap-2 px-6">
            <Link href="/sign-up">
              <span>Start Tracking Free</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <Button size="lg" variant="outline" asChild className="border-zinc-800">
            <Link href="/sign-in">Live Demo Login</Link>
          </Button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-2 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">Sub-5ms Ingestion</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Engineered with Neon Postgres connection pooling and Effect-TS validation pipelines.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-2 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
              <Radio className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">Real-time Event Stream</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Watch incoming live user actions instantly via server-sent events as they happen.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 space-y-2 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">Privacy & CORS Guards</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Anonymized IP hashing and origin whitelists prevent unauthorized spam and protect privacy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
