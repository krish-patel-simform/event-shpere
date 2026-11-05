-- No two sessions may hold the same hall at the same time, enforced by the database itself.
--
-- The service already checks this before it saves (hallBookingService.assertHallFree), but a check
-- followed by a save is two steps: two requests at the same moment can both pass the check and
-- both save. This constraint makes the second save fail, so a hall can never be double-booked.
--
-- Drizzle cannot express an EXCLUDE constraint, so this is a custom migration (written by hand).
-- If two sessions already overlap in one hall, ADD CONSTRAINT fails with "could not create
-- exclusion constraint ... Key (...) conflicts with key (...)" and nothing is changed (the migrator
-- runs this whole file in one transaction). Move or cancel one of the two, then migrate again.

-- Lets one index combine an equality (hall_id =) with a range overlap (&&).
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- A session HOLDS its hall while it is not cancelled and has a time (draft or scheduled), the same
-- rule as hall-booking.repository. tstzrange is half open (the start counts, the end does not), so
-- a session that ends at 12:00 does not clash with one that starts at 12:00: back to back is fine.
-- Online sessions (no hall), unplaced sessions (no time) and cancelled sessions are not covered.
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_no_hall_overlap"
  EXCLUDE USING gist (
    "hall_id" WITH =,
    tstzrange("start_at", "end_at") WITH &&
  )
  WHERE ("status" <> 'cancelled' AND "hall_id" IS NOT NULL AND "start_at" IS NOT NULL);
