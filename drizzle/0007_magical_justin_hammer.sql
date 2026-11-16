CREATE TYPE "public"."session_mode" AS ENUM('in_person', 'online', 'hybrid');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "mode" "session_mode" DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "online_url" text;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "online_url";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_online_url_https" CHECK ("sessions"."online_url" IS NULL OR "sessions"."online_url" ~ '^https://[^[:space:]]+$');--> statement-breakpoint
DROP TYPE "public"."event_mode";