'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EventRow } from './event-row';
import { EventDrawer } from './event-drawer';
import { getLiveEventsAction } from '../actions';
import type { Event } from '@/lib/db/schema';
import {
  Play,
  Pause,
  Trash2,
  Search,
  Radio,
  FilterX,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiveStreamFeedProps {
  projectSlug: string;
  initialEvents: Event[];
}

export function LiveStreamFeed({
  projectSlug,
  initialEvents,
}: LiveStreamFeedProps) {
  const [events, setEvents] = React.useState<Event[]>(initialEvents);
  const [isLive, setIsLive] = React.useState(true);
  const [eventNameFilter, setEventNameFilter] = React.useState('');
  const [distinctIdFilter, setDistinctIdFilter] = React.useState('');
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const clearedAtRef = React.useRef<number | null>(null);

  // Keep a ref to events to read latest in interval callback
  const eventsRef = React.useRef(events);
  eventsRef.current = events;

  const fetchLatestEvents = React.useCallback(async () => {
    const currentEvents = eventsRef.current;
    let since: Date | undefined;

    if (currentEvents.length > 0) {
      since = new Date(currentEvents[0].timestamp);
    } else if (clearedAtRef.current) {
      since = new Date(clearedAtRef.current);
    }

    try {
      setIsRefreshing(true);
      const res = await getLiveEventsAction({
        projectSlug,
        since,
        limit: 50,
      });

      if (res.success && res.events && res.events.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newUniqueEvents = (res.events as Event[]).filter(
            (e) => !existingIds.has(e.id)
          );

          if (newUniqueEvents.length === 0) return prev;

          // Merge new items at head and sort by timestamp desc
          const merged = [...newUniqueEvents, ...prev];
          merged.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          // Keep buffer capped at 300 to maintain high performance
          return merged.slice(0, 300);
        });
      }
    } catch (err) {
      console.error('Failed to poll live events:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectSlug]);

  // Polling loop every 3 seconds when isLive
  React.useEffect(() => {
    if (!isLive) return;

    const intervalId = setInterval(() => {
      fetchLatestEvents();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isLive, fetchLatestEvents]);

  const handleClearFeed = () => {
    clearedAtRef.current = Date.now();
    setEvents([]);
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  // Client-side filtering for instant feedback
  const filteredEvents = React.useMemo(() => {
    return events.filter((ev) => {
      if (
        eventNameFilter &&
        !ev.eventName.toLowerCase().includes(eventNameFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        distinctIdFilter &&
        !ev.distinctId.toLowerCase().includes(distinctIdFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [events, eventNameFilter, distinctIdFilter]);

  const hasActiveFilters = Boolean(eventNameFilter || distinctIdFilter);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-zinc-800/90 bg-zinc-950 p-3 shadow-sm">
        {/* Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Pulsating Live / Paused Badge */}
          <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 shadow-xs">
            {isLive ? (
              <>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-400 select-none">
                  Live
                </span>
              </>
            ) : (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                <span className="text-xs font-medium text-amber-400 select-none">
                  Paused
                </span>
              </>
            )}
          </div>

          {/* Pause / Resume Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="h-8 gap-1.5 text-xs border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:text-white"
          >
            {isLive ? (
              <>
                <Pause className="h-3.5 w-3.5 text-zinc-400" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                Resume
              </>
            )}
          </Button>

          {/* Clear Feed Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFeed}
            className="h-8 gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>

          {isRefreshing && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-500" />
          )}
        </div>

        {/* Filters & Count */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Name Filter */}
          <div className="relative w-full sm:w-44">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            <Input
              type="text"
              placeholder="Filter event..."
              value={eventNameFilter}
              onChange={(e) => setEventNameFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500"
            />
          </div>

          {/* Distinct ID Filter */}
          <div className="relative w-full sm:w-44">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            <Input
              type="text"
              placeholder="Filter user..."
              value={distinctIdFilter}
              onChange={(e) => setDistinctIdFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 font-mono"
            />
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEventNameFilter('');
                setDistinctIdFilter('');
              }}
              className="h-8 px-2 text-xs text-zinc-400 hover:text-zinc-200"
              title="Reset filters"
            >
              <FilterX className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Buffered Count */}
          <Badge
            variant="outline"
            className="h-8 border-zinc-800 text-zinc-400 font-mono text-[11px] px-2.5 whitespace-nowrap"
          >
            {filteredEvents.length} events
            {filteredEvents.length !== events.length &&
              ` (${events.length} total)`}
          </Badge>
        </div>
      </div>

      {/* Events Table / Empty State */}
      <div className="rounded-xl border border-zinc-800/90 bg-zinc-950 shadow-sm overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            {events.length === 0 ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 mb-3 border border-zinc-800">
                  <Radio className="h-6 w-6 animate-pulse text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  Waiting for live events
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Incoming telemetry will automatically stream here every 3
                  seconds. Send a capture call to start viewing live payloads.
                </p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 mb-3 border border-zinc-800">
                  <FilterX className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">
                  No events match active filters
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Try clearing or relaxing your event name or distinct ID
                  filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEventNameFilter('');
                    setDistinctIdFilter('');
                  }}
                  className="mt-4 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  Clear Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-zinc-900/40">
              <TableRow className="border-zinc-800/80 hover:bg-transparent">
                <TableHead className="w-[110px]">Time</TableHead>
                <TableHead className="w-[160px]">Event Name</TableHead>
                <TableHead className="w-[180px]">Distinct ID</TableHead>
                <TableHead className="min-w-[200px]">Path</TableHead>
                <TableHead className="w-[110px]">Country</TableHead>
                <TableHead className="w-[160px]">Browser / OS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onSelect={handleSelectEvent}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Slide-Over Event Drawer */}
      <EventDrawer
        event={selectedEvent}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projectSlug={projectSlug}
      />
    </div>
  );
}
