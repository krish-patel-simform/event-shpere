CREATE TABLE "session_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_registration_id" uuid NOT NULL,
	"event_check_in_id" uuid NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" uuid,
	"method" "check_in_method" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_check_ins" ADD CONSTRAINT "session_check_ins_session_registration_id_session_registrations_id_fk" FOREIGN KEY ("session_registration_id") REFERENCES "public"."session_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_check_ins" ADD CONSTRAINT "session_check_ins_event_check_in_id_event_check_ins_id_fk" FOREIGN KEY ("event_check_in_id") REFERENCES "public"."event_check_ins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_check_ins" ADD CONSTRAINT "session_check_ins_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_check_ins_session_registration_unique" ON "session_check_ins" USING btree ("session_registration_id");--> statement-breakpoint
CREATE INDEX "session_check_ins_event_check_in_idx" ON "session_check_ins" USING btree ("event_check_in_id");--> statement-breakpoint
CREATE INDEX "session_check_ins_checked_in_at_idx" ON "session_check_ins" USING btree ("checked_in_at");