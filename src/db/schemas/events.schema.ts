import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { speakersProfilesTable, usersTable } from "./auth.schema";

// "Completed" is not a status: it is simply end_at < now().
export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "cancelled",
]);

// Decides whether a venue or an online link is needed (DISC-3 "event type").
export const eventModeEnum = pgEnum("event_mode", [
  "in_person",
  "online",
  "hybrid",
]);

export const sessionTypeEnum = pgEnum("session_type", [
  "talk",
  "workshop",
  "panel",
  "keynote",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "draft",
  "scheduled",
  "cancelled",
]);

export const sessionSpeakerRoleEnum = pgEnum("session_speaker_role", [
  "speaker",
  "moderator",
  "host",
]);

// Shared by event and session registrations. Attendance is never stored here (see event_check_ins).
export const registrationStatusEnum = pgEnum("registration_status", [
  "registered",
  "cancelled",
]);

export const checkInMethodEnum = pgEnum("check_in_method", [
  "qr_scan",
  "manual",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Shape check only (e.g. Asia/Kolkata, UTC, America/Argentina/Buenos_Aires).
// Whether the zone really exists is validated by Zod, because Postgres cannot
// look up pg_timezone_names inside a CHECK.
const TIMEZONE_SHAPE = sql.raw(`'^[A-Za-z]+(/[A-Za-z0-9_+-]+)*$'`);

/** Step 1: a real place that hosts events. Address stored once, shared by every event held there. */
export const venuesTable = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    addressLine: text("address_line").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }),
    // Text, not a number: some countries use letters and some codes start with 0.
    postalCode: varchar("postal_code", { length: 20 }),
    // Two-letter ISO code.
    country: varchar("country", { length: 2 }).notNull().default("IN"),
    // IANA zone of the place; copied onto events that use this venue.
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Kolkata"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    // Retire a venue without deleting it; inactive venues cannot be picked for new events.
    isActive: boolean("is_active").notNull().default(true),
    // restrict: an admin who added venues cannot be deleted.
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The same venue cannot be added twice with different spelling.
    uniqueIndex("venues_name_city_unique").on(
      sql`lower(${t.name})`,
      sql`lower(${t.city})`,
    ),
    index("venues_city_idx").on(t.city),
    check("venues_country_two_letters", sql`${t.country} ~ '^[A-Z]{2}$'`),
    check("venues_timezone_shape", sql`${t.timezone} ~ ${TIMEZONE_SHAPE}`),
    check(
      "venues_latitude_range",
      sql`${t.latitude} IS NULL OR ${t.latitude} BETWEEN -90 AND 90`,
    ),
    check(
      "venues_longitude_range",
      sql`${t.longitude} IS NULL OR ${t.longitude} BETWEEN -180 AND 180`,
    ),
  ],
);

/** Step 2: one event. The descriptive half (about, images, FAQs) lives in the Strapi Event Page. */
export const eventsTable = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The owner: powers "only the owner can edit" and the organizer's "my events".
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    status: eventStatusEnum("status").notNull().default("draft"),
    mode: eventModeEnum("mode").notNull().default("in_person"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    // IANA zone; filled from the venue when one is picked (online events choose their own).
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Kolkata"),
    // Nullable: a draft is saved before a venue is chosen and online events have none.
    // "In-person/hybrid needs a venue" is checked by the service on Publish, not on every save.
    venueId: uuid("venue_id").references(() => venuesTable.id, {
      onDelete: "restrict",
    }),
    // Shown only to registered users, never on the public page.
    onlineUrl: text("online_url"),
    // Null = no limit.
    capacity: integer("capacity"),
    // Paise: 150000 = ₹1,500. 0 = free.
    ticketPrice: integer("ticket_price").notNull().default(0),
    // Three-letter ISO code; Stripe needs it with every amount.
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    // Null = open as soon as published.
    registrationOpensAt: timestamp("registration_opens_at", {
      withTimezone: true,
    }),
    // Null = closes when the event starts.
    registrationClosesAt: timestamp("registration_closes_at", {
      withTimezone: true,
    }),
    // Strapi documentId of the Event Page; null until Strapi answers.
    cmsEventId: text("cms_event_id").unique(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Public "upcoming events" list.
    index("events_status_start_idx").on(t.status, t.startAt),
    // Organizer dashboard.
    index("events_organizer_idx").on(t.organizerId),
    index("events_venue_idx").on(t.venueId),
    check("events_end_after_start", sql`${t.endAt} > ${t.startAt}`),
    check(
      "events_capacity_positive",
      sql`${t.capacity} IS NULL OR ${t.capacity} > 0`,
    ),
    check("events_ticket_price_non_negative", sql`${t.ticketPrice} >= 0`),
    check("events_currency_three_letters", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check("events_timezone_shape", sql`${t.timezone} ~ ${TIMEZONE_SHAPE}`),
    // cancelled_at is set exactly when the event is cancelled.
    check(
      "events_cancelled_at_matches_status",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
    ),
    // Anything past draft has been published at some point.
    check(
      "events_published_at_after_draft",
      sql`${t.status} = 'draft' OR ${t.publishedAt} IS NOT NULL`,
    ),
    check(
      "events_registration_window_order",
      sql`${t.registrationOpensAt} IS NULL OR ${t.registrationClosesAt} IS NULL OR ${t.registrationClosesAt} > ${t.registrationOpensAt}`,
    ),
  ],
);

/** Step 3: rooms of one venue, shared by every event held there. */
export const hallsTable = pgTable(
  "halls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venuesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    // Seats in the room; also the seat limit for sessions here that need booking.
    capacity: integer("capacity").notNull(),
    // Left-to-right order of the columns on the schedule board.
    sortOrder: integer("sort_order").notNull().default(0),
    // Retire a hall without deleting it; inactive halls cannot take new sessions.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One venue cannot have both "Hall A" and "hall a".
    uniqueIndex("halls_venue_name_unique").on(t.venueId, sql`lower(${t.name})`),
    check("halls_capacity_positive", sql`${t.capacity} > 0`),
  ],
);

/**
 * Step 4: talks, workshops, panels, keynotes. A session can exist without a hall or time
 * (the "unplaced" tray on the board).
 *
 * NOT expressible in Drizzle, added in a custom migration (`drizzle-kit generate --custom`):
 * no two *scheduled* sessions in one hall at the same time, across all events.
 *   CREATE EXTENSION IF NOT EXISTS btree_gist;
 *   ALTER TABLE sessions ADD CONSTRAINT sessions_no_hall_overlap
 *     EXCLUDE USING gist (hall_id WITH =, tstzrange(start_at, end_at) WITH &&)
 *     WHERE (status = 'scheduled' AND hall_id IS NOT NULL);
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // cascade: a draft event takes its sessions with it (published events are cancelled, not deleted).
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    // Null = not placed yet, or an online event. The service checks the hall belongs to the event's venue.
    hallId: uuid("hall_id").references(() => hallsTable.id, {
      onDelete: "restrict",
    }),
    title: varchar("title", { length: 255 }).notNull(),
    // Strapi documentId of the Session Details entry; null until Strapi answers.
    cmsSessionId: text("cms_session_id").unique(),
    type: sessionTypeEnum("type").notNull(),
    status: sessionStatusEnum("status").notNull().default("draft"),
    // Both null while unplaced.
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    // true = attendees must book a seat; the limit is the hall's capacity.
    requiresRegistration: boolean("requires_registration")
      .notNull()
      .default(false),
    // Paise on top of the event ticket; 0 = included. Currency comes from the event.
    price: integer("price").notNull().default(0),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Public schedule.
    index("sessions_event_start_idx").on(t.eventId, t.startAt),
    // Schedule board.
    index("sessions_hall_idx").on(t.hallId),
    check(
      "sessions_times_both_or_none",
      sql`(${t.startAt} IS NULL AND ${t.endAt} IS NULL) OR (${t.startAt} IS NOT NULL AND ${t.endAt} IS NOT NULL AND ${t.endAt} > ${t.startAt})`,
    ),
    check(
      "sessions_scheduled_has_times",
      sql`${t.status} <> 'scheduled' OR ${t.startAt} IS NOT NULL`,
    ),
    check("sessions_price_non_negative", sql`${t.price} >= 0`),
    check(
      "sessions_cancelled_at_matches_status",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

/** Step 5: which speaker is in which session (many-to-many). A panel has several. */
export const sessionSpeakersTable = pgTable(
  "session_speakers",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "cascade" }),
    // speaker_profiles.id (which in turn points to users). restrict: a speaker on a session cannot be deleted by accident.
    speakerId: uuid("speaker_id")
      .notNull()
      .references(() => speakersProfilesTable.id, { onDelete: "restrict" }),
    role: sessionSpeakerRoleEnum("role").notNull().default("speaker"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.speakerId] }),
    // "Which sessions is this speaker in?"
    index("session_speakers_speaker_idx").on(t.speakerId),
  ],
);

/** Step 6: who signed up for which event (the ticket). Attendance lives in event_check_ins. */
export const eventRegistrationsTable = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // restrict: an event with attendees cannot be deleted.
    eventId: uuid("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: registrationStatusEnum("status").notNull().default("registered"),
    // Random, unambiguous characters (no 0/O, 1/I), e.g. EVT-7K3Q9P. Inside the QR code.
    ticketCode: varchar("ticket_code", { length: 32 }).notNull().unique(),
    // Reset to now when someone re-registers after cancelling (the same row flips back).
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Must be cleared (set to null) when the row flips back to registered.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One registration per user per event, even on a double click.
    uniqueIndex("event_registrations_event_user_unique").on(
      t.eventId,
      t.userId,
    ),
    // "Seats taken" count on every registration.
    index("event_registrations_event_status_idx").on(t.eventId, t.status),
    // "My registrations".
    index("event_registrations_user_idx").on(t.userId),
    check(
      "event_registrations_cancelled_at_matches_status",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

/** Step 7: seat bookings for sessions with requires_registration = true (e.g. a 30-seat workshop). */
export const sessionRegistrationsTable = pgTable(
  "session_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessionsTable.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    status: registrationStatusEnum("status").notNull().default("registered"),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One booking per person per session.
    uniqueIndex("session_registrations_session_user_unique").on(
      t.sessionId,
      t.userId,
    ),
    // "Seats left" count.
    index("session_registrations_session_status_idx").on(t.sessionId, t.status),
    index("session_registrations_user_idx").on(t.userId),
    check(
      "session_registrations_cancelled_at_matches_status",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

/** Step 8: who actually came. One row per registration per event day. */
export const eventCheckInsTable = pgTable(
  "event_check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Pointing to the registration guarantees only registered people are checked in,
    // and gives both the user and the event.
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => eventRegistrationsTable.id, { onDelete: "restrict" }),
    // The event day in the event's time zone (events.timezone); day 1 and day 2 are separate rows.
    attendanceDate: date("attendance_date").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The organizer who scanned/checked the person in. Null is kept for self check-in later.
    // set null: keep the attendance record if that user is deleted.
    checkedInBy: uuid("checked_in_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    method: checkInMethodEnum("method").notNull(),
  },
  (t) => [
    // One check-in per person per day: a second scan is rejected by Postgres.
    uniqueIndex("event_check_ins_registration_date_unique").on(
      t.registrationId,
      t.attendanceDate,
    ),
    // Arrivals-by-hour chart.
    index("event_check_ins_checked_in_at_idx").on(t.checkedInAt),
  ],
);

export const venuesRelations = relations(venuesTable, ({ one, many }) => ({
  createdByUser: one(usersTable, {
    fields: [venuesTable.createdBy],
    references: [usersTable.id],
  }),
  halls: many(hallsTable),
  events: many(eventsTable),
}));

export const eventsRelations = relations(eventsTable, ({ one, many }) => ({
  organizer: one(usersTable, {
    fields: [eventsTable.organizerId],
    references: [usersTable.id],
  }),
  venue: one(venuesTable, {
    fields: [eventsTable.venueId],
    references: [venuesTable.id],
  }),
  sessions: many(sessionsTable),
  registrations: many(eventRegistrationsTable),
}));

export const hallsRelations = relations(hallsTable, ({ one, many }) => ({
  venue: one(venuesTable, {
    fields: [hallsTable.venueId],
    references: [venuesTable.id],
  }),
  sessions: many(sessionsTable),
}));

export const sessionsRelations = relations(sessionsTable, ({ one, many }) => ({
  event: one(eventsTable, {
    fields: [sessionsTable.eventId],
    references: [eventsTable.id],
  }),
  hall: one(hallsTable, {
    fields: [sessionsTable.hallId],
    references: [hallsTable.id],
  }),
  speakers: many(sessionSpeakersTable),
  registrations: many(sessionRegistrationsTable),
}));

export const sessionSpeakersRelations = relations(
  sessionSpeakersTable,
  ({ one }) => ({
    session: one(sessionsTable, {
      fields: [sessionSpeakersTable.sessionId],
      references: [sessionsTable.id],
    }),
    speaker: one(speakersProfilesTable, {
      fields: [sessionSpeakersTable.speakerId],
      references: [speakersProfilesTable.id],
    }),
  }),
);

export const eventRegistrationsRelations = relations(
  eventRegistrationsTable,
  ({ one, many }) => ({
    event: one(eventsTable, {
      fields: [eventRegistrationsTable.eventId],
      references: [eventsTable.id],
    }),
    user: one(usersTable, {
      fields: [eventRegistrationsTable.userId],
      references: [usersTable.id],
    }),
    checkIns: many(eventCheckInsTable),
  }),
);

export const sessionRegistrationsRelations = relations(
  sessionRegistrationsTable,
  ({ one }) => ({
    session: one(sessionsTable, {
      fields: [sessionRegistrationsTable.sessionId],
      references: [sessionsTable.id],
    }),
    user: one(usersTable, {
      fields: [sessionRegistrationsTable.userId],
      references: [usersTable.id],
    }),
  }),
);

export const eventCheckInsRelations = relations(
  eventCheckInsTable,
  ({ one }) => ({
    registration: one(eventRegistrationsTable, {
      fields: [eventCheckInsTable.registrationId],
      references: [eventRegistrationsTable.id],
    }),
    checkedInByUser: one(usersTable, {
      fields: [eventCheckInsTable.checkedInBy],
      references: [usersTable.id],
    }),
  }),
);

export type Venue = typeof venuesTable.$inferSelect;
export type NewVenue = typeof venuesTable.$inferInsert;
export type EventRecord = typeof eventsTable.$inferSelect;
export type NewEventRecord = typeof eventsTable.$inferInsert;
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type EventMode = (typeof eventModeEnum.enumValues)[number];
export type Hall = typeof hallsTable.$inferSelect;
export type EventSession = typeof sessionsTable.$inferSelect;
export type SessionType = (typeof sessionTypeEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type SessionSpeaker = typeof sessionSpeakersTable.$inferSelect;
export type EventRegistration = typeof eventRegistrationsTable.$inferSelect;
export type SessionRegistration = typeof sessionRegistrationsTable.$inferSelect;
export type RegistrationStatus =
  (typeof registrationStatusEnum.enumValues)[number];
export type EventCheckIn = typeof eventCheckInsTable.$inferSelect;
