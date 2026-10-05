import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkOrgId: varchar('clerk_org_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('organizations_clerk_org_id_idx').on(table.clerkOrgId),
    index('organizations_slug_idx').on(table.slug),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }).notNull(),
    clerkOrgId: varchar('clerk_org_id', { length: 255 }),
    apiKey: varchar('api_key', { length: 64 }).notNull().unique(),
    secretKey: varchar('secret_key', { length: 64 }),
    allowedDomains: text('allowed_domains').array(),
    timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
    dataRetentionDays: integer('data_retention_days').default(365).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('projects_slug_idx').on(table.slug),
    index('projects_clerk_user_id_idx').on(table.clerkUserId),
    index('projects_clerk_org_id_idx').on(table.clerkOrgId),
    index('projects_api_key_idx').on(table.apiKey),
  ]
);

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
    userAgent: text('user_agent'),
    browser: varchar('browser', { length: 64 }),
    browserVersion: varchar('browser_version', { length: 64 }),
    os: varchar('os', { length: 64 }),
    deviceType: varchar('device_type', { length: 32 }),
    screenWidth: integer('screen_width'),
    screenHeight: integer('screen_height'),
    ipHash: varchar('ip_hash', { length: 64 }),
    countryCode: varchar('country_code', { length: 2 }),
    region: varchar('region', { length: 64 }),
    city: varchar('city', { length: 128 }),
    referrer: text('referrer'),
    referrerDomain: varchar('referrer_domain', { length: 255 }),
    pageUrl: text('page_url'),
    pagePath: varchar('page_path', { length: 512 }),
    utmSource: varchar('utm_source', { length: 128 }),
    utmMedium: varchar('utm_medium', { length: 128 }),
    utmCampaign: varchar('utm_campaign', { length: 128 }),
    utmTerm: varchar('utm_term', { length: 128 }),
    utmContent: varchar('utm_content', { length: 128 }),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('events_project_id_idx').on(table.projectId),
    index('events_distinct_id_idx').on(table.distinctId),
    index('events_timestamp_idx').on(table.timestamp),
    index('events_name_idx').on(table.eventName),
    index('events_page_path_idx').on(table.pagePath),
    index('events_referrer_domain_idx').on(table.referrerDomain),
    index('events_browser_idx').on(table.browser),
    index('events_os_idx').on(table.os),
    index('events_country_code_idx').on(table.countryCode),
    index('events_utm_campaign_idx').on(table.utmCampaign),
  ]
);

export const persons = pgTable(
  'persons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    distinctId: varchar('distinct_id', { length: 255 }).notNull(),
    properties: jsonb('properties').default({}).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('persons_project_id_distinct_id_idx').on(table.projectId, table.distinctId),
    uniqueIndex('persons_project_distinct_unique').on(table.projectId, table.distinctId),
  ]
);

export const personAliases = pgTable(
  'person_aliases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    aliasId: varchar('alias_id', { length: 255 }).notNull(),
    personDistinctId: varchar('person_distinct_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('person_aliases_project_id_alias_id_idx').on(table.projectId, table.aliasId),
    uniqueIndex('person_aliases_project_alias_unique').on(table.projectId, table.aliasId),
  ]
);

export const dashboards = pgTable(
  'dashboards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dashboards_project_id_idx').on(table.projectId),
  ]
);

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    dashboardId: uuid('dashboard_id').references(() => dashboards.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(), // trend, funnel, retention, table
    queryConfig: jsonb('query_config').default({}).notNull(),
    layout: jsonb('layout').default({}).notNull(),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('insights_project_id_idx').on(table.projectId),
    index('insights_dashboard_id_idx').on(table.dashboardId),
  ]
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.clerkOrgId],
    references: [organizations.clerkOrgId],
  }),
  events: many(events),
  persons: many(persons),
  personAliases: many(personAliases),
  dashboards: many(dashboards),
  insights: many(insights),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  project: one(projects, {
    fields: [events.projectId],
    references: [projects.id],
  }),
}));

export const personsRelations = relations(persons, ({ one }) => ({
  project: one(projects, {
    fields: [persons.projectId],
    references: [projects.id],
  }),
}));

export const personAliasesRelations = relations(personAliases, ({ one }) => ({
  project: one(projects, {
    fields: [personAliases.projectId],
    references: [projects.id],
  }),
}));

export const dashboardsRelations = relations(dashboards, ({ one, many }) => ({
  project: one(projects, {
    fields: [dashboards.projectId],
    references: [projects.id],
  }),
  insights: many(insights),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
  project: one(projects, {
    fields: [insights.projectId],
    references: [projects.id],
  }),
  dashboard: one(dashboards, {
    fields: [insights.dashboardId],
    references: [dashboards.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Person = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type PersonAlias = typeof personAliases.$inferSelect;
export type NewPersonAlias = typeof personAliases.$inferInsert;
export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
