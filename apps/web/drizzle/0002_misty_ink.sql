CREATE TABLE IF NOT EXISTS "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"dashboard_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"query_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"alias_id" varchar(255) NOT NULL,
	"person_distinct_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"distinct_id" varchar(255) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "user_agent" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "browser" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "browser_version" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "os" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "device_type" varchar(32);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "screen_width" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "screen_height" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "region" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "city" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "referrer" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "referrer_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "page_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "page_path" varchar(512);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "utm_source" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "utm_medium" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "utm_term" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "utm_content" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "secret_key" varchar(64);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "timezone" varchar(64) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "data_retention_days" integer DEFAULT 365 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dashboards_project_id_projects_id_fk') THEN
    ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insights_project_id_projects_id_fk') THEN
    ALTER TABLE "insights" ADD CONSTRAINT "insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insights_dashboard_id_dashboards_id_fk') THEN
    ALTER TABLE "insights" ADD CONSTRAINT "insights_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_aliases_project_id_projects_id_fk') THEN
    ALTER TABLE "person_aliases" ADD CONSTRAINT "person_aliases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persons_project_id_projects_id_fk') THEN
    ALTER TABLE "persons" ADD CONSTRAINT "persons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboards_project_id_idx" ON "dashboards" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insights_project_id_idx" ON "insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "insights_dashboard_id_idx" ON "insights" USING btree ("dashboard_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_aliases_project_id_alias_id_idx" ON "person_aliases" USING btree ("project_id","alias_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_aliases_project_alias_unique" ON "person_aliases" USING btree ("project_id","alias_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_project_id_distinct_id_idx" ON "persons" USING btree ("project_id","distinct_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "persons_project_distinct_unique" ON "persons" USING btree ("project_id","distinct_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_page_path_idx" ON "events" USING btree ("page_path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_referrer_domain_idx" ON "events" USING btree ("referrer_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_browser_idx" ON "events" USING btree ("browser");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_os_idx" ON "events" USING btree ("os");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_country_code_idx" ON "events" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_utm_campaign_idx" ON "events" USING btree ("utm_campaign");