'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPersonsAction } from '../actions';
import type { ListPersonsResult, PersonListItem } from '../types';
import { formatRelativeTime } from '@/features/live-stream/components/event-row';

interface PersonListProps {
  projectSlug: string;
  initialData: ListPersonsResult;
}

export function PersonList({ projectSlug, initialData }: PersonListProps) {
  const router = useRouter();
  const [data, setData] = React.useState<ListPersonsResult>(initialData);
  const [search, setSearch] = React.useState('');
  const [isPending, startTransition] = React.useTransition();

  const pageSize = data.limit || 20;
  const currentPage = Math.floor((data.offset || 0) / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  const fetchPage = React.useCallback(
    (newOffset: number, searchFilter: string) => {
      startTransition(async () => {
        const res = await getPersonsAction({
          projectSlug,
          search: searchFilter || undefined,
          limit: pageSize,
          offset: newOffset,
        });

        if (res.success) {
          setData(res.data);
        }
      });
    },
    [projectSlug, pageSize]
  );

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(0, search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, fetchPage]);

  const handleRowClick = (distinctId: string) => {
    router.push(`/${projectSlug}/persons/${encodeURIComponent(distinctId)}`);
  };

  const getInitials = (item: PersonListItem): string => {
    if (item.name && item.name.trim()) {
      const parts = item.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (item.email && item.email.trim()) {
      return item.email.trim().slice(0, 2).toUpperCase();
    }
    return item.distinctId.slice(0, 2).toUpperCase();
  };

  // Filter traits to display as clean badges (excluding system/verbose objects)
  const getDisplayTraits = (properties: Record<string, unknown>) => {
    const excludedKeys = new Set([
      'name',
      'email',
      '$name',
      '$email',
      'distinct_id',
      '$distinct_id',
      'avatar',
      'password',
      'token',
    ]);
    const traits: { key: string; value: string }[] = [];

    for (const [k, v] of Object.entries(properties)) {
      if (excludedKeys.has(k)) continue;
      if (v === null || v === undefined) continue;
      if (typeof v === 'object') continue;
      traits.push({ key: k, value: String(v) });
      if (traits.length >= 3) break;
    }

    return traits;
  };

  return (
    <div className="space-y-4">
      {/* Search Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by distinct ID, email, or name..."
            className="pl-9 h-9 text-xs bg-surface/60 border-edge placeholder:text-muted focus:border-signal"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            {data.total} {data.total === 1 ? 'person' : 'persons'} tracked
          </span>
          {isPending && (
            <span className="flex items-center gap-1.5 text-muted text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse" />
              Loading...
            </span>
          )}
        </div>
      </div>

      {/* Persons Table */}
      <div className="rounded-lg border border-edge/80 bg-surface/60 overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-edge bg-surface/40 hover:bg-surface/40">
              <TableHead className="text-muted font-medium text-xs h-10 w-[35%]">
                User Identifier
              </TableHead>
              <TableHead className="text-muted font-medium text-xs h-10">
                Custom Traits
              </TableHead>
              <TableHead className="text-muted font-medium text-xs h-10 text-right">
                Events
              </TableHead>
              <TableHead className="text-muted font-medium text-xs h-10 text-right">
                First Seen
              </TableHead>
              <TableHead className="text-muted font-medium text-xs h-10 text-right">
                Last Seen
              </TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.persons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 text-muted">
                    <Users className="h-8 w-8 text-muted/60" />
                    <p className="text-xs font-medium text-muted">
                      {search ? `No persons match "${search}"` : 'No persons identified yet'}
                    </p>
                    <p className="text-[11px] text-muted max-w-sm">
                      Call <code className="text-foreground font-mono">opentrack.identify(userId, traits)</code> from your client SDK to link anonymous activity to user profiles.
                    </p>
                    {search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearch('')}
                        className="mt-2 h-7 text-xs"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.persons.map((person) => {
                const initials = getInitials(person);
                const traits = getDisplayTraits(person.properties);
                const firstSeen = new Date(person.firstSeenAt);
                const lastSeen = new Date(person.lastSeenAt);

                return (
                  <TableRow
                    key={person.id}
                    onClick={() => handleRowClick(person.distinctId)}
                    className="cursor-pointer border-b border-edge/60 transition-colors hover:bg-surface/50 group select-none text-xs"
                  >
                    {/* Identifier */}
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-edge border border-edge/60 text-foreground font-semibold font-mono text-[11px] group-hover:border-edge transition-colors">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          {person.name ? (
                            <div>
                              <div className="font-medium text-foreground truncate group-hover:text-white transition-colors">
                                {person.name}
                              </div>
                              <div className="text-[11px] text-muted font-mono truncate">
                                {person.email || person.distinctId}
                              </div>
                            </div>
                          ) : person.email ? (
                            <div>
                              <div className="font-medium text-foreground truncate group-hover:text-white transition-colors">
                                {person.email}
                              </div>
                              <div className="text-[11px] text-muted font-mono truncate">
                                {person.distinctId}
                              </div>
                            </div>
                          ) : (
                            <div className="font-mono text-foreground font-medium truncate group-hover:text-white transition-colors">
                              {person.distinctId}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Traits */}
                    <TableCell className="py-3">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                        {traits.length === 0 ? (
                          <span className="text-[11px] text-muted font-mono">—</span>
                        ) : (
                          traits.map((t) => (
                            <Badge
                              key={t.key}
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 font-mono border-edge bg-surface/80 text-foreground"
                            >
                              <span className="text-muted">{t.key}:</span>
                              <span className="ml-1 text-foreground font-medium">{t.value}</span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>

                    {/* Total Events */}
                    <TableCell className="py-3 text-right">
                      <Badge
                        variant="outline"
                        className="font-mono text-[11px] border-edge text-foreground bg-surface/40"
                      >
                        {person.totalEvents.toLocaleString()}
                      </Badge>
                    </TableCell>

                    {/* First Seen */}
                    <TableCell
                      className="py-3 text-right font-mono text-[11px] text-muted whitespace-nowrap"
                      title={firstSeen.toUTCString()}
                    >
                      {formatRelativeTime(firstSeen)}
                    </TableCell>

                    {/* Last Seen */}
                    <TableCell
                      className="py-3 text-right font-mono text-[11px] text-muted whitespace-nowrap"
                      title={lastSeen.toUTCString()}
                    >
                      {formatRelativeTime(lastSeen)}
                    </TableCell>

                    {/* Action Arrow */}
                    <TableCell className="py-3 text-right pr-4">
                      <ArrowRight className="h-3.5 w-3.5 text-muted group-hover:text-foreground transition-colors group-hover:translate-x-0.5 transform duration-150" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, data.total)} of {data.total}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isPending}
              onClick={() => fetchPage((currentPage - 2) * pageSize, search)}
              className="h-8 px-2.5 text-xs border-edge bg-surface/50 hover:bg-edge"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted px-2 font-mono">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => fetchPage(currentPage * pageSize, search)}
              className="h-8 px-2.5 text-xs border-edge bg-surface/50 hover:bg-edge"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
