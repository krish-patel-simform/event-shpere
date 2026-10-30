CREATE TYPE "public"."check_in_method" AS ENUM('qr_scan', 'manual');--> statement-breakpoint
CREATE TYPE "public"."event_mode" AS ENUM('in_person', 'online', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('registered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_speaker_role" AS ENUM('speaker', 'moderator', 'host');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('draft', 'scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('talk', 'workshop', 'panel', 'keynote');--> statement-breakpoint
CREATE TABLE "event_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" uuid,
	"method" "check_in_method" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'registered' NOT NULL,
	"ticket_code" varchar(32) NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registrations_ticket_code_unique" UNIQUE("ticket_code"),
	CONSTRAINT "event_registrations_cancelled_at_matches_status" CHECK (("event_registrations"."status" = 'cancelled') = ("event_registrations"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"mode" "event_mode" DEFAULT 'in_person' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"venue_id" uuid,
	"online_url" text,
	"capacity" integer,
	"ticket_price" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"cms_event_id" text,
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_cms_event_id_unique" UNIQUE("cms_event_id"),
	CONSTRAINT "events_end_after_start" CHECK ("events"."end_at" > "events"."start_at"),
	CONSTRAINT "events_capacity_positive" CHECK ("events"."capacity" IS NULL OR "events"."capacity" > 0),
	CONSTRAINT "events_ticket_price_non_negative" CHECK ("events"."ticket_price" >= 0),
	CONSTRAINT "events_currency_three_letters" CHECK ("events"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "events_timezone_shape" CHECK ("events"."timezone" ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "events_cancelled_at_matches_status" CHECK (("events"."status" = 'cancelled') = ("events"."cancelled_at" IS NOT NULL)),
	CONSTRAINT "events_published_at_after_draft" CHECK ("events"."status" = 'draft' OR "events"."published_at" IS NOT NULL),
	CONSTRAINT "events_registration_window_order" CHECK ("events"."registration_opens_at" IS NULL OR "events"."registration_closes_at" IS NULL OR "events"."registration_closes_at" > "events"."registration_opens_at")
);
--> statement-breakpoint
CREATE TABLE "halls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"capacity" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "halls_capacity_positive" CHECK ("halls"."capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "session_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_registrations_cancelled_at_matches_status" CHECK (("session_registrations"."status" = 'cancelled') = ("session_registrations"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "session_speakers" (
	"session_id" uuid NOT NULL,
	"speaker_id" uuid NOT NULL,
	"role" "session_speaker_role" DEFAULT 'speaker' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_speakers_session_id_speaker_id_pk" PRIMARY KEY("session_id","speaker_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"hall_id" uuid,
	"title" varchar(255) NOT NULL,
	"cms_session_id" text,
	"type" "session_type" NOT NULL,
	"status" "session_status" DEFAULT 'draft' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"requires_registration" boolean DEFAULT false NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_cms_session_id_unique" UNIQUE("cms_session_id"),
	CONSTRAINT "sessions_times_both_or_none" CHECK (("sessions"."start_at" IS NULL AND "sessions"."end_at" IS NULL) OR ("sessions"."start_at" IS NOT NULL AND "sessions"."end_at" IS NOT NULL AND "sessions"."end_at" > "sessions"."start_at")),
	CONSTRAINT "sessions_scheduled_has_times" CHECK ("sessions"."status" <> 'scheduled' OR "sessions"."start_at" IS NOT NULL),
	CONSTRAINT "sessions_price_non_negative" CHECK ("sessions"."price" >= 0),
	CONSTRAINT "sessions_cancelled_at_matches_status" CHECK (("sessions"."status" = 'cancelled') = ("sessions"."cancelled_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address_line" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'IN' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_country_two_letters" CHECK ("venues"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "venues_timezone_shape" CHECK ("venues"."timezone" ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)*$'),
	CONSTRAINT "venues_latitude_range" CHECK ("venues"."latitude" IS NULL OR "venues"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "venues_longitude_range" CHECK ("venues"."longitude" IS NULL OR "venues"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "halls" ADD CONSTRAINT "halls_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_speakers" ADD CONSTRAINT "session_speakers_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_speakers" ADD CONSTRAINT "session_speakers_speaker_id_speaker_profiles_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speaker_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_hall_id_halls_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."halls"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_check_ins_registration_date_unique" ON "event_check_ins" USING btree ("registration_id","attendance_date");--> statement-breakpoint
CREATE INDEX "event_check_ins_checked_in_at_idx" ON "event_check_ins" USING btree ("checked_in_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_unique" ON "event_registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_event_status_idx" ON "event_registrations" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_registrations_user_idx" ON "event_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_status_start_idx" ON "events" USING btree ("status","start_at");--> statement-breakpoint
CREATE INDEX "events_organizer_idx" ON "events" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "events_venue_idx" ON "events" USING btree ("venue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "halls_venue_name_unique" ON "halls" USING btree ("venue_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "session_registrations_session_user_unique" ON "session_registrations" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "session_registrations_session_status_idx" ON "session_registrations" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "session_registrations_user_idx" ON "session_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_speakers_speaker_idx" ON "session_speakers" USING btree ("speaker_id");--> statement-breakpoint
CREATE INDEX "sessions_event_start_idx" ON "sessions" USING btree ("event_id","start_at");--> statement-breakpoint
CREATE INDEX "sessions_hall_idx" ON "sessions" USING btree ("hall_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_name_city_unique" ON "venues" USING btree (lower("name"),lower("city"));--> statement-breakpoint
CREATE INDEX "venues_city_idx" ON "venues" USING btree ("city");