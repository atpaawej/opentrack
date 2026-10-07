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
    const exit = await Effect.runPromiseExit(listUserProjects({ clerkUserId: userId, clerkOrgId: orgId }));
    if (Exit.isSuccess(exit) && exit.value.length > 0) redirect(`/${exit.value[0].slug}`);
    return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground"><CreateFirstProject /></main>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-edge/50">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8" aria-label="Main navigation">
          <Link href="/" className="flex items-center gap-2.5 rounded-sm text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-xs font-bold text-background">OT</span>
            OpenTrack
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button variant="ghost" size="sm" asChild><Link href="/sign-in">Sign in</Link></Button>
            <Button size="sm" asChild><Link href="/sign-up">Create a project</Link></Button>
          </div>
        </nav>
      </header>

      <main>
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20 lg:py-32">
          <div className="max-w-xl">
            <h1 className="text-[clamp(2.6rem,5vw,5.2rem)] font-semibold leading-[1.08] tracking-[-0.045em]">
              What happened after you shipped?
            </h1>
            <p className="mt-7 max-w-[49ch] text-base leading-relaxed text-muted sm:text-lg">
              OpenTrack shows who visited, what they did, and where they stopped. Add tracking to your app, then measure the actions that matter to you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href="/sign-up">Create a project</Link></Button>
              <Button size="lg" variant="outline" asChild><a href="https://github.com/atpaawej/opentrack" target="_blank" rel="noopener noreferrer">View the source</a></Button>
            </div>
            <p className="mt-5 text-sm text-muted">Open source · Self-hostable</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-edge/70 bg-surface" aria-label="Example of events an app can track">
            <div className="border-b border-edge/50 px-5 py-4 text-sm font-medium">From a visit to an answer</div>
            <ol className="px-5 py-3">
              <li className="flex gap-4 border-b border-edge/40 py-4">
                <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-signal" />
                <div><p className="font-mono text-sm text-foreground">$pageview</p><p className="mt-1 text-sm text-muted">Recorded when someone opens a page.</p></div>
              </li>
              <li className="flex gap-4 border-b border-edge/40 py-4">
                <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#A2B9EE]" />
                <div><p className="font-mono text-sm text-foreground">signup_completed</p><p className="mt-1 text-sm text-muted">Add this event when someone signs up.</p></div>
              </li>
              <li className="flex gap-4 py-4">
                <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#E6B483]" />
                <div><p className="font-mono text-sm text-foreground">feature_used</p><p className="mt-1 text-sm text-muted">Find out whether people reach the thing you built.</p></div>
              </li>
            </ol>
            <div className="border-t border-edge/50 bg-background/40 px-5 py-4 font-mono text-xs text-muted">
              <span className="text-signal">capture</span>(<span className="text-foreground">&apos;signup_completed&apos;</span>)
              <span className="mt-1 block font-sans">Example event; custom actions need instrumentation.</span>
            </div>
          </div>
        </div>

        <section className="border-t border-edge/50" aria-labelledby="how-it-works">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <h2 id="how-it-works" className="text-xl font-semibold">A short path from install to insight</h2>
            <ol className="mt-7 grid gap-0 border-y border-edge/50 md:grid-cols-3 md:divide-x md:divide-edge/50">
              <li className="py-6 md:pr-7"><p className="text-sm font-medium text-signal">1. Connect</p><h3 className="mt-2 font-semibold">Add the tracker</h3><p className="mt-2 text-sm leading-relaxed text-muted">Pageviews work automatically once the SDK is installed.</p></li>
              <li className="border-t border-edge/50 py-6 md:border-t-0 md:px-7"><p className="text-sm font-medium text-signal">2. Capture</p><h3 className="mt-2 font-semibold">Name the important moments</h3><p className="mt-2 text-sm leading-relaxed text-muted">Send events for signups, feature use, or whatever success means for your app.</p></li>
              <li className="border-t border-edge/50 py-6 md:border-t-0 md:pl-7"><p className="text-sm font-medium text-signal">3. Understand</p><h3 className="mt-2 font-semibold">Explore and build funnels</h3><p className="mt-2 text-sm leading-relaxed text-muted">Compare traffic and investigate where a tracked journey ends.</p></li>
            </ol>
          </div>
        </section>
      </main>
      <footer className="border-t border-edge/50 px-5 py-7 text-center text-sm text-muted">OpenTrack · Open-source analytics for the apps you ship</footer>
    </div>
  );
}
