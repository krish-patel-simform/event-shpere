ALTER TABLE "organizer_profiles" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD COLUMN "rejected_by" uuid;--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_not_verified_and_rejected" CHECK ("organizer_profiles"."verified_at" IS NULL OR "organizer_profiles"."rejected_at" IS NULL);--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_rejected_needs_reason" CHECK ("organizer_profiles"."rejected_at" IS NULL OR "organizer_profiles"."rejection_reason" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_rejected_by_needs_at" CHECK ("organizer_profiles"."rejected_by" IS NULL OR "organizer_profiles"."rejected_at" IS NOT NULL);