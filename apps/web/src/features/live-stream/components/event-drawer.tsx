'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Check,
  ArrowUpRight,
  User,
  Globe,
  Monitor,
  ShieldCheck,
  Clock,
  Layers,
  Code2,
  Cpu,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Event } from '@/lib/db/schema';

export function getEventBadgeColor(eventName: string): {
  bg: string;
  text: string;
  border: string;
} {
  const lower = eventName.toLowerCase();
  if (lower === '$pageview' || lower === 'pageview') {
    return {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/20',
    };
  }
  if (lower === '$identify' || lower === 'identify' || lower === '$alias') {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
    };
  }
  if (
    lower.includes('error') ||
    lower.includes('fail') ||
    lower.includes('exception')
  ) {
    return {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
    };
  }
  return {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  };
}

export interface EventDrawerProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
}

export function EventDrawer({
  event,
  isOpen,
  onClose,
  projectSlug,
}: EventDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  if (!event) {
    return null;
  }

  const badgeColors = getEventBadgeColor(event.eventName);
  const eventDate = new Date(event.timestamp);
  const formattedUtc = eventDate.toUTCString();

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      toast.success('Event JSON copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const customProperties =
    event.properties && typeof event.properties === 'object'
      ? (event.properties as Record<string, unknown>)
      : {};

  const customKeys = Object.keys(customProperties);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col h-full overflow-hidden w-full sm:max-w-xl md:max-w-2xl bg-zinc-950 border-zinc-800 p-0 text-zinc-100"
      >
        {/* Header */}
        <div className="border-b border-zinc-800/80 p-5 pr-12 bg-zinc-900/30">
          <SheetHeader className="text-left space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-mono font-medium border',
                  badgeColors.bg,
                  badgeColors.text,
                  badgeColors.border
                )}
              >
                {event.eventName}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                <Clock className="h-3 w-3 text-zinc-500" />
                {formattedUtc}
              </span>
            </div>
            <SheetTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              Event Inspector
              <span className="text-xs font-normal text-zinc-500 font-mono">
                {event.id.slice(0, 8)}
              </span>
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-400">
              Detailed payload and telemetry metadata for project{' '}
              <span className="font-mono text-zinc-300">{projectSlug}</span>.
            </SheetDescription>
          </SheetHeader>

          {/* Quick link button to Person Profile */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-900/60 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-400">
                  Distinct ID
                </div>
                <div
                  className="font-mono text-xs text-zinc-200 truncate max-w-[240px] sm:max-w-xs"
                  title={event.distinctId}
                >
                  {event.distinctId}
                </div>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium border-zinc-700 bg-zinc-850 hover:bg-zinc-800 hover:text-white shrink-0"
            >
              <Link href={`/${projectSlug}/persons/${encodeURIComponent(event.distinctId)}`}>
                Person Profile
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs Body */}
        <div className="flex-1 overflow-hidden p-5 flex flex-col min-h-0">
          <Tabs defaultValue="properties" className="flex flex-col h-full min-h-0">
            <TabsList className="grid grid-cols-3 w-full shrink-0">
              <TabsTrigger value="properties" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-1.5 text-xs">
                <Code2 className="h-3.5 w-3.5" />
                Raw JSON
              </TabsTrigger>
              <TabsTrigger value="network" className="gap-1.5 text-xs">
                <Cpu className="h-3.5 w-3.5" />
                Client Context
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Properties */}
            <TabsContent
              value="properties"
              className="flex-1 overflow-y-auto space-y-6 mt-4 pr-1 min-h-0"
            >
              {/* Custom Properties */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Event Properties ({customKeys.length})
                </h4>
                {customKeys.length === 0 ? (
                  <div className="rounded-md border border-zinc-800/80 bg-zinc-900/30 p-4 text-center text-xs text-zinc-500">
                    No custom properties attached to this event.
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-900/20">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50">
                          <th className="px-3 py-2 font-medium text-zinc-400 w-1/3">
                            Key
                          </th>
                          <th className="px-3 py-2 font-medium text-zinc-400">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850/60 font-mono">
                        {customKeys.map((key) => {
                          const val = customProperties[key];
                          const displayVal =
                            typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val);
                          return (
                            <tr
                              key={key}
                              className="hover:bg-zinc-900/40 transition-colors"
                            >
                              <td className="px-3 py-2 text-zinc-300 font-medium select-all">
                                {key}
                              </td>
                              <td className="px-3 py-2 text-zinc-400 break-all select-all">
                                {displayVal}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* System Dimensions */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  System Dimensions
                </h4>
                <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-900/20">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="px-3 py-2 font-medium text-zinc-400 w-1/3">
                          Dimension
                        </th>
                        <th className="px-3 py-2 font-medium text-zinc-400">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60 text-zinc-300">
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Page Path
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-200 break-all">
                          {event.pagePath || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Full URL
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-400 break-all text-[11px]">
                          {event.pageUrl || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Referrer Domain
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-300">
                          {event.referrerDomain || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Browser
                        </td>
                        <td className="px-3 py-2">
                          {event.browser
                            ? `${event.browser} ${event.browserVersion || ''}`
                            : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Operating System
                        </td>
                        <td className="px-3 py-2">{event.os || '-'}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Device Type
                        </td>
                        <td className="px-3 py-2 capitalize">
                          {event.deviceType || '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Location
                        </td>
                        <td className="px-3 py-2">
                          {event.countryCode
                            ? `${event.countryCode} - ${event.city || 'Unknown'}`
                            : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium text-zinc-400">
                          Session ID
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-400 break-all">
                          {event.sessionId || '-'}
                        </td>
                      </tr>
                      {(event.utmSource ||
                        event.utmMedium ||
                        event.utmCampaign) && (
                        <tr>
                          <td className="px-3 py-2 font-medium text-zinc-400">
                            UTM Parameters
                          </td>
                          <td className="px-3 py-2 text-[11px] font-mono text-zinc-400">
                            {[
                              event.utmSource && `source: ${event.utmSource}`,
                              event.utmMedium && `medium: ${event.utmMedium}`,
                              event.utmCampaign &&
                                `campaign: ${event.utmCampaign}`,
                            ]
                              .filter(Boolean)
                              .join(' | ')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Raw JSON */}
            <TabsContent
              value="json"
              className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-zinc-400">
                  Full serializable database entity
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="h-8 gap-1.5 text-xs border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>
              <div className="flex-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 font-mono text-xs text-zinc-300">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </div>
            </TabsContent>

            {/* TAB 3: Network & Client Context */}
            <TabsContent
              value="network"
              className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1 min-h-0"
            >
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/20 p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      IP Hash (Anonymized)
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      SHA-256
                    </Badge>
                  </div>
                  <div className="rounded bg-zinc-900 p-2.5 font-mono text-xs text-zinc-300 break-all select-all border border-zinc-800">
                    {event.ipHash || 'Not available'}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-zinc-400 block mb-1">
                    User Agent String
                  </span>
                  <div className="rounded bg-zinc-900 p-2.5 font-mono text-[11px] text-zinc-300 break-all select-all border border-zinc-800 leading-relaxed">
                    {event.userAgent || 'Not available'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500 font-medium">
                      Screen Dimensions
                    </div>
                    <div className="text-sm font-mono text-zinc-200 mt-1">
                      {event.screenWidth && event.screenHeight
                        ? `${event.screenWidth} × ${event.screenHeight}`
                        : 'Unknown'}
                    </div>
                  </div>
                  <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500 font-medium">
                      Region / City
                    </div>
                    <div className="text-sm text-zinc-200 mt-1">
                      {event.city
                        ? `${event.city}, ${event.region || ''}`
                        : event.region || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500 font-medium">
                      Database Event ID
                    </div>
                    <div className="text-xs font-mono text-zinc-300 mt-1 break-all select-all">
                      {event.id}
                    </div>
                  </div>
                  <div className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-[11px] text-zinc-500 font-medium">
                      Ingestion Timestamp (DB)
                    </div>
                    <div className="text-xs font-mono text-zinc-300 mt-1">
                      {new Date(event.createdAt).toISOString()}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
