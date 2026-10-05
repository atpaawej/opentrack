import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 64 }).notNull().unique(),
  allowedDomains: text('allowed_domains').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    eventName: varchar('event_name', { length: 255 }).notNull(),
    distinctId: varchar('distinct_id', { length: 255 }).notNull(),
    sessionId: varchar('session_id', { length: 64 }),
    properties: jsonb('properties').default({}).notNull(),
    ipHash: varchar('ip_hash', { length: 64 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('events_project_id_idx').on(table.projectId),
    index('events_distinct_id_idx').on(table.distinctId),
    index('events_timestamp_idx').on(table.timestamp),
    index('events_name_idx').on(table.eventName),
  ]
);

export const projectsRelations = relations(projects, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  project: one(projects, {
    fields: [events.projectId],
    references: [projects.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
