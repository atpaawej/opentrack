'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Copy,
  Check,
  Plus,
  Clock,
  Calendar,
  Globe,
  Monitor,
  Activity,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  Layers,
  Terminal,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PersonProfileDetail, PersonSession } from '../types';
import type { Event, Person } from '@/lib/db/schema';
import { updatePersonTraitAction } from '../actions';
import { formatRelativeTime, getCountryFlag } from '@/features/live-stream/components/event-row';
import { getEventBadgeColor } from '@/features/live-stream/components/event-drawer';

interface PersonProfileProps {
  projectSlug: string;
  initialProfile: PersonProfileDetail;
}

export function PersonProfile({ projectSlug, initialProfile }: PersonProfileProps) {
  const [profile, setProfile] = React.useState<PersonProfileDetail>(initialProfile);
  const [copiedId, setCopiedId] = React.useState(false);
  const [addTraitOpen, setAddTraitOpen] = React.useState(false);
  const [newKey, setNewKey] = React.useState('');
  const [newValue, setNewValue] = React.useState('');
  const [isSavingTrait, setIsSavingTrait] = React.useState(false);

  const { person, aliases, sessions, totalEvents } = profile;
  const properties = (person.properties as Record<string, unknown>) || {};

  // Infer user display name & email
  const email =
    typeof properties.email === 'string'
      ? properties.email
      : typeof properties.$email === 'string'
      ? properties.$email
      : null;
  const name =
    typeof properties.name === 'string'
      ? properties.name
      : typeof properties.$name === 'string'
      ? properties.$name
      : null;

  // Latest event metadata (for country, browser, os)
  const latestEvent = sessions[0]?.events[sessions[0].events.length - 1];

  const handleCopyDistinctId = () => {
    navigator.clipboard.writeText(person.distinctId);
    setCopiedId(true);
    toast.success('Distinct ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAddTrait = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) {
      toast.error('Trait key is required');
      return;
    }

    setIsSavingTrait(true);
    try {
      // Parse JSON if valid (e.g. numbers, booleans, objects), else string
      let parsedValue: unknown = newValue.trim();
      if (parsedValue === 'true') parsedValue = true;
      else if (parsedValue === 'false') parsedValue = false;
      else if (!isNaN(Number(parsedValue)) && parsedValue !== '') parsedValue = Number(parsedValue);
      else {
        try {
          if (
            (typeof parsedValue === 'string' && parsedValue.startsWith('{') && parsedValue.endsWith('}')) ||
            (typeof parsedValue === 'string' && parsedValue.startsWith('[') && parsedValue.endsWith(']'))
          ) {
            parsedValue = JSON.parse(parsedValue);
          }
        } catch {
          // keep as string
        }
      }

      const res = await updatePersonTraitAction({
        projectSlug,
        distinctId: person.distinctId,
        key: newKey.trim(),
        value: parsedValue,
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to save trait');
        return;
      }

      setProfile((prev) => ({
        ...prev,
        person: res.person,
      }));

      setNewKey('');
      setNewValue('');
      setAddTraitOpen(false);
      toast.success(`Trait "${newKey.trim()}" saved successfully`);
    } catch (err: any) {
      toast.error(err?.message || 'Error updating trait');
    } finally {
      setIsSavingTrait(false);
    }
  };

  const getInitials = (): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.trim().slice(0, 2).toUpperCase();
    }
    return person.distinctId.slice(0, 2).toUpperCase();
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 5) return '< 5s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    if (mins < 60) {
      return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
    }
    const hrs = Math.floor(mins / 60);
    const remMin = mins % 60;
    return `${hrs}h ${remMin}m`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${projectSlug}/persons`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors select-none group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Persons
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-xs border-zinc-800 bg-zinc-900/60 text-zinc-300"
          >
            {totalEvents} {totalEvents === 1 ? 'total event' : 'total events'}
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-xs border-zinc-800 bg-zinc-900/60 text-zinc-300"
          >
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
          </Badge>
        </div>
      </div>

      {/* Person Header Card */}
      <Card className="border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            {/* User Identity Column */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-750 text-zinc-100 font-bold font-mono text-lg shadow-inner">
                {getInitials()}
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                    {name || email || person.distinctId}
                  </h1>
                  {email && name && (
                    <span className="text-xs text-zinc-400 font-normal">
                      ({email})
                    </span>
                  )}
                </div>

                {/* Distinct ID with 1-click copy */}
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-500 font-mono">distinct_id:</span>
                  <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 border border-zinc-800 select-all">
                    {person.distinctId}
                  </code>
                  <button
                    onClick={handleCopyDistinctId}
                    className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
                    title="Copy distinct ID"
                  >
                    {copiedId ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Aliases List if present */}
                {aliases.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-zinc-500">Aliases:</span>
                    {aliases.map((alias) => (
                      <Badge
                        key={alias}
                        variant="secondary"
                        className="text-[10px] py-0 px-1.5 font-mono border-zinc-850 text-zinc-400 bg-zinc-900"
                      >
                        {alias}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Context Stats Column */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-zinc-850 pt-4 md:pt-0 md:pl-6 text-xs shrink-0">
              {/* Location */}
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Location
                </div>
                <div className="text-zinc-200 font-medium flex items-center gap-1.5">
                  {latestEvent?.countryCode ? (
                    <>
                      <span>{getCountryFlag(latestEvent.countryCode)}</span>
                      <span>
                        {latestEvent.city ? `${latestEvent.city}, ` : ''}
                        {latestEvent.countryCode}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500 font-mono">Unknown</span>
                  )}
                </div>
              </div>

              {/* Device */}
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Monitor className="h-3 w-3" />
                  Device
                </div>
                <div className="text-zinc-200 font-medium truncate">
                  {latestEvent?.browser || latestEvent?.os ? (
                    `${latestEvent.browser || 'Unknown'} / ${latestEvent.os || 'Unknown'}`
                  ) : (
                    <span className="text-zinc-500 font-mono">—</span>
                  )}
                </div>
              </div>

              {/* First Seen */}
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  First Seen
                </div>
                <div
                  className="text-zinc-200 font-medium font-mono text-[11px]"
                  title={new Date(person.firstSeenAt).toUTCString()}
                >
                  {formatRelativeTime(new Date(person.firstSeenAt))}
                </div>
              </div>

              {/* Last Seen */}
              <div className="space-y-1">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last Seen
                </div>
                <div
                  className="text-zinc-200 font-medium font-mono text-[11px]"
                  title={new Date(person.lastSeenAt).toUTCString()}
                >
                  {formatRelativeTime(new Date(person.lastSeenAt))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Traits Section */}
      <Card className="border-zinc-800/80 bg-zinc-950/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span>User Traits</span>
              <Badge
                variant="secondary"
                className="text-[10px] font-mono px-1.5 py-0 border-zinc-800 text-zinc-400"
              >
                {Object.keys(properties).length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Custom attributes, metadata, and properties associated with this person.
            </CardDescription>
          </div>

          {/* Add Trait Dialog */}
          <Dialog open={addTraitOpen} onOpenChange={setAddTraitOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:text-zinc-100"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Trait
              </Button>
            </DialogTrigger>
            <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
              <form onSubmit={handleAddTrait}>
                <DialogHeader>
                  <DialogTitle className="text-base text-zinc-100">Add or Update Trait</DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400">
                    Add a custom key-value property to this user profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Trait Key
                    </label>
                    <Input
                      placeholder="e.g. plan, tier, role, company"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="h-8 text-xs bg-zinc-900 border-zinc-800 font-mono"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">
                      Value
                    </label>
                    <Input
                      placeholder="e.g. enterprise, pro, true, 42"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="h-8 text-xs bg-zinc-900 border-zinc-800 font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddTraitOpen(false)}
                    className="h-8 text-xs text-zinc-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingTrait || !newKey.trim()}
                    className="h-8 text-xs bg-zinc-100 text-zinc-900 hover:bg-white"
                  >
                    {isSavingTrait ? 'Saving...' : 'Save Trait'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {Object.keys(properties).length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-850 rounded-lg bg-zinc-900/20 text-zinc-500">
              <p className="text-xs font-medium text-zinc-400">No custom traits recorded</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Click &quot;Add Trait&quot; above or identify the user with properties via SDK.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-850/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900/40">
                    <TableHead className="text-zinc-400 font-medium text-xs h-9 w-[30%] font-mono">
                      Key
                    </TableHead>
                    <TableHead className="text-zinc-400 font-medium text-xs h-9">
                      Value
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(properties).map(([k, v]) => {
                    const formattedValue =
                      typeof v === 'object' && v !== null
                        ? JSON.stringify(v)
                        : String(v);

                    return (
                      <TableRow
                        key={k}
                        className="border-b border-zinc-850/60 hover:bg-zinc-900/30 text-xs"
                      >
                        <TableCell className="py-2.5 font-mono text-zinc-300 font-medium">
                          {k}
                        </TableCell>
                        <TableCell className="py-2.5 text-zinc-200 font-mono text-[11px] break-all">
                          {formattedValue}
                        </TableCell>
                        <TableCell className="py-2.5 text-right pr-3">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(formattedValue);
                              toast.success(`Copied "${k}" value`);
                            }}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            title="Copy value"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Activity Timeline Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-850/80 pb-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Activity Timeline
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chronological journey of {totalEvents} events grouped into {sessions.length} sessions.
            </p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-850 p-12 text-center text-zinc-500 bg-zinc-950/40">
            <Clock className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
            <p className="text-xs font-medium text-zinc-400">No activity recorded</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Events triggered by this user will appear here grouped by session.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session, sIdx) => {
              const sessionIndex = sessions.length - sIdx;
              return (
                <SessionTimelineCard
                  key={session.sessionId || `session_${sIdx}`}
                  session={session}
                  sessionIndex={sessionIndex}
                  formatDuration={formatDuration}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionTimelineCardProps {
  session: PersonSession;
  sessionIndex: number;
  formatDuration: (seconds: number) => string;
}

function SessionTimelineCard({
  session,
  sessionIndex,
  formatDuration,
}: SessionTimelineCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const startTime = new Date(session.startTime);

  return (
    <div className="rounded-lg border border-zinc-850/90 bg-zinc-950/60 overflow-hidden shadow-xs">
      {/* Session Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-900/90 cursor-pointer border-b border-zinc-850/80 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800 text-zinc-300 font-mono text-xs font-semibold">
            #{sessionIndex}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                Session {session.sessionId ? `(${session.sessionId.slice(0, 14)}...)` : `#${sessionIndex}`}
              </span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {startTime.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                at{' '}
                {startTime.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-zinc-300 font-mono text-[11px]"
          >
            <Clock className="h-3 w-3 mr-1 text-zinc-400" />
            {formatDuration(session.duration)}
          </Badge>
          <Badge
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-zinc-300 font-mono text-[11px]"
          >
            {session.pageCount} {session.pageCount === 1 ? 'page' : 'pages'}
          </Badge>
          <Badge
            variant="secondary"
            className="border-zinc-800 bg-zinc-850 text-zinc-300 font-mono text-[11px]"
          >
            {session.events.length} {session.events.length === 1 ? 'event' : 'events'}
          </Badge>
          <button className="text-zinc-400 hover:text-zinc-200 ml-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Events inside Session */}
      {isExpanded && (
        <div className="p-4 bg-zinc-950/40">
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-800">
            {session.events.map((event, eventIdx) => (
              <EventTimelineItem key={event.id || `${session.sessionId}_${eventIdx}`} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EventTimelineItemProps {
  event: Event;
}

function EventTimelineItem({ event }: EventTimelineItemProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const badgeStyle = getEventBadgeColor(event.eventName);
  const date = new Date(event.timestamp);
  const properties = (event.properties as Record<string, unknown>) || {};
  const hasProps = Object.keys(properties).length > 0;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    toast.success('Raw event JSON copied');
  };

  return (
    <div className="relative group">
      {/* Node Dot on Timeline */}
      <div className="absolute -left-[19px] top-2 h-2.5 w-2.5 rounded-full bg-zinc-950 border-2 border-zinc-600 group-hover:border-zinc-400 transition-colors" />

      <div className="rounded-md border border-zinc-850/80 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors p-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Event Name Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-medium border shadow-xs',
                badgeStyle.bg,
                badgeStyle.text,
                badgeStyle.border
              )}
            >
              {event.eventName}
            </span>

            {/* Path or action identifier */}
            {event.pagePath && (
              <span className="font-mono text-zinc-300 text-[11px] truncate max-w-sm bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-850">
                {event.pagePath}
              </span>
            )}

            {/* If button / element text in props */}
            {typeof properties.element_text === 'string' && (
              <span className="text-zinc-400 text-[11px] truncate">
                &ldquo;{properties.element_text}&rdquo;
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Time */}
            <span
              className="text-[11px] font-mono text-zinc-400"
              title={date.toUTCString()}
            >
              {date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>

            {/* Toggle Expand */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded"
              title={isOpen ? 'Collapse event details' : 'Expand event details'}
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        {isOpen && (
          <div className="mt-3 pt-3 border-t border-zinc-850">
            <Tabs defaultValue="properties" className="w-full">
              <div className="flex items-center justify-between mb-2">
                <TabsList className="h-7 bg-zinc-900 p-0.5 border border-zinc-800">
                  <TabsTrigger
                    value="properties"
                    className="text-[11px] h-6 px-2.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Properties ({Object.keys(properties).length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw"
                    className="text-[11px] h-6 px-2.5 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100"
                  >
                    <Code2 className="h-3 w-3 mr-1" />
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyJson}
                  className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-200"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy JSON
                </Button>
              </div>

              {/* Formatted Properties Tab */}
              <TabsContent value="properties" className="mt-0 space-y-2">
                {hasProps ? (
                  <div className="rounded border border-zinc-800/80 bg-zinc-950/70 p-2 font-mono text-[11px] max-h-60 overflow-y-auto space-y-1">
                    {Object.entries(properties).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-2 py-0.5">
                        <span className="text-zinc-400 shrink-0 select-all">{k}:</span>
                        <span className="text-zinc-200 select-all break-all">
                          {typeof v === 'object' && v !== null
                            ? JSON.stringify(v)
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 py-1 font-mono">
                    No custom event properties.
                  </p>
                )}

                {/* System Context Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] text-zinc-400">
                  {event.browser && (
                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 border-zinc-800 bg-zinc-900">
                      browser: {event.browser} {event.browserVersion || ''}
                    </Badge>
                  )}
                  {event.os && (
                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 border-zinc-800 bg-zinc-900">
                      os: {event.os}
                    </Badge>
                  )}
                  {event.deviceType && (
                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 border-zinc-800 bg-zinc-900">
                      device: {event.deviceType}
                    </Badge>
                  )}
                  {event.countryCode && (
                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 border-zinc-800 bg-zinc-900">
                      geo: {event.countryCode} {event.city ? `(${event.city})` : ''}
                    </Badge>
                  )}
                </div>
              </TabsContent>

              {/* Raw JSON Tab */}
              <TabsContent value="raw" className="mt-0">
                <pre className="rounded border border-zinc-800/80 bg-zinc-950/90 p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-72">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
