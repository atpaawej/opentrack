import type { Person, Event } from '@/lib/db/schema';

export interface PersonListItem {
  id: string;
  distinctId: string;
  properties: Record<string, unknown>;
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
  totalEvents: number;
  email: string | null;
  name: string | null;
}

export interface PersonSession {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in seconds
  pageCount: number;
  events: Event[];
}

export interface PersonProfileDetail {
  person: Person;
  aliases: string[];
  sessions: PersonSession[];
  totalEvents: number;
}

export interface ListPersonsOptions {
  search?: string;
  limit?: number | string;
  offset?: number | string;
}

export interface ListPersonsResult {
  persons: PersonListItem[];
  total: number;
  limit: number;
  offset: number;
}
