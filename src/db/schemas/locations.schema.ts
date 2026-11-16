import { sql } from "drizzle-orm";
import { check, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Reference data: the states and union territories a venue can be in. Rows come from the seed,
 * not from users, so every venue and filter uses the same spelling.
 */
export const statesTable = pgTable(
  "states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    // ISO 3166-2 (IN-GJ). It already includes the country, so it is unique on its own.
    code: varchar("code", { length: 6 }).notNull().unique(),
    // Two-letter ISO country code. Null while the app is India-only; it becomes a foreign key
    // to a countries table when countries are added.
    countryCode: varchar("country_code", { length: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("states_code_shape", sql`${t.code} ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'`),
    check(
      "states_country_two_letters",
      sql`${t.countryCode} IS NULL OR ${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
  ],
);

export type State = typeof statesTable.$inferSelect;
