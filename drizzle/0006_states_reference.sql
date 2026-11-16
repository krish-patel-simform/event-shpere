CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(6) NOT NULL,
	"country_code" varchar(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "states_code_unique" UNIQUE("code"),
	CONSTRAINT "states_code_shape" CHECK ("states"."code" ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
	CONSTRAINT "states_country_two_letters" CHECK ("states"."country_code" IS NULL OR "states"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
-- Hand-written: the states rows must exist before venues can point at them (same list as the seed).
INSERT INTO "states" ("code", "name") VALUES
	('IN-AP', 'Andhra Pradesh'),
	('IN-AR', 'Arunachal Pradesh'),
	('IN-AS', 'Assam'),
	('IN-BR', 'Bihar'),
	('IN-CG', 'Chhattisgarh'),
	('IN-GA', 'Goa'),
	('IN-GJ', 'Gujarat'),
	('IN-HR', 'Haryana'),
	('IN-HP', 'Himachal Pradesh'),
	('IN-JH', 'Jharkhand'),
	('IN-KA', 'Karnataka'),
	('IN-KL', 'Kerala'),
	('IN-MP', 'Madhya Pradesh'),
	('IN-MH', 'Maharashtra'),
	('IN-MN', 'Manipur'),
	('IN-ML', 'Meghalaya'),
	('IN-MZ', 'Mizoram'),
	('IN-NL', 'Nagaland'),
	('IN-OD', 'Odisha'),
	('IN-PB', 'Punjab'),
	('IN-RJ', 'Rajasthan'),
	('IN-SK', 'Sikkim'),
	('IN-TN', 'Tamil Nadu'),
	('IN-TS', 'Telangana'),
	('IN-TR', 'Tripura'),
	('IN-UP', 'Uttar Pradesh'),
	('IN-UK', 'Uttarakhand'),
	('IN-WB', 'West Bengal'),
	('IN-AN', 'Andaman and Nicobar Islands'),
	('IN-CH', 'Chandigarh'),
	('IN-DH', 'Dadra and Nagar Haveli and Daman and Diu'),
	('IN-DL', 'Delhi'),
	('IN-JK', 'Jammu and Kashmir'),
	('IN-LA', 'Ladakh'),
	('IN-LD', 'Lakshadweep'),
	('IN-PY', 'Puducherry');--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "state_id" uuid;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "venues_state_id_idx" ON "venues" USING btree ("state_id");--> statement-breakpoint
-- Hand-written: copy each venue's old state text onto the matching state before the column goes.
-- A venue whose text matches no state keeps state_id NULL.
UPDATE "venues" SET "state_id" = "states"."id"
FROM "states"
WHERE lower(trim("venues"."state")) = lower("states"."name");--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "state";