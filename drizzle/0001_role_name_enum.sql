CREATE TYPE "public"."role_name" AS ENUM('user', 'speaker', 'organizer', 'admin');--> statement-breakpoint
ALTER TABLE "roles" DROP CONSTRAINT "roles_name_unique";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "role" "role_name" NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_role_unique" UNIQUE("role");