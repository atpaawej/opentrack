'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Event } from '@/lib/db/schema';
import { getEventBadgeColor } from './event-drawer';
import { Globe, Monitor, Terminal } from 'lucide-react';

export interface EventRowProps {
  event: Event;
  onSelect: (event: Event) => void;
}

export function formatRelativeTime(dateInput: Date | string | number): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getCountryFlag(countryCode?: string | null): string | null {
  if (!countryCode || countryCode.length !== 2) return null;
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return null;
  }
}

export function EventRow({ event, onSelect }: EventRowProps) {
  const badgeColors = getEventBadgeColor(event.eventName);
  const flag = getCountryFlag(event.countryCode);
  const eventDate = new Date(event.timestamp);
  const relativeTime = formatRelativeTime(eventDate);
  const fullUtc = eventDate.toUTCString();

  return (
    <tr
      onClick={() => onSelect(event)}
      className="group cursor-pointer border-b border-zinc-850/60 transition-all duration-150 hover:bg-zinc-900/60 active:scale-[0.99] select-none text-xs"
    >
      {/* Timestamp */}
      <td
        className="px-4 py-3 whitespace-nowrap text-zinc-400 font-mono text-[11px]"
        title={fullUtc}
      >
        <span className="group-hover:text-zinc-200 transition-colors">
          {relativeTime}
        </span>
      </td>

      {/* Event Name Badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs font-medium border shadow-xs',
            badgeColors.bg,
            badgeColors.text,
            badgeColors.border
          )}
        >
          {event.eventName}
        </span>
      </td>

      {/* Distinct ID */}
      <td className="px-4 py-3 whitespace-nowrap font-mono text-zinc-300">
        <span
          className="truncate max-w-[140px] sm:max-w-[180px] inline-block align-middle"
          title={event.distinctId}
        >
          {event.distinctId}
        </span>
      </td>

      {/* Path */}
      <td className="px-4 py-3 whitespace-nowrap font-mono text-zinc-400 text-[11px]">
        <span
          className="truncate max-w-[160px] sm:max-w-[220px] inline-block align-middle group-hover:text-zinc-200 transition-colors"
          title={event.pagePath || event.pageUrl || '-'}
        >
          {event.pagePath || '-'}
        </span>
      </td>

      {/* Country / Location */}
      <td className="px-4 py-3 whitespace-nowrap">
        {event.countryCode ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-mono text-zinc-300 border border-zinc-800"
            title={`${event.countryCode} ${event.city ? `(${event.city})` : ''}`}
          >
            {flag && <span className="text-xs">{flag}</span>}
            <span>{event.countryCode}</span>
          </span>
        ) : (
          <span className="text-zinc-600">-</span>
        )}
      </td>

      {/* Browser & OS */}
      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
        <div className="flex items-center gap-1.5">
          {event.browser ? (
            <span
              className="inline-flex items-center gap-1 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[11px] text-zinc-300 border border-zinc-800"
              title={`${event.browser} on ${event.os || 'Unknown OS'}`}
            >
              <Monitor className="h-3 w-3 text-zinc-500" />
              <span>{event.browser}</span>
              {event.os && (
                <span className="text-zinc-500 text-[10px]">/ {event.os}</span>
              )}
            </span>
          ) : (
            <span className="text-zinc-600">-</span>
          )}
        </div>
      </td>
    </tr>
  );
}
