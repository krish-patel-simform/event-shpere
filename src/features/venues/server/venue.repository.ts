import "server-only";
import {
  and,
  asc,
  count,
  desc,
  DrizzleQueryError,
  eq,
  ilike,
  inArray,
  max,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { escapeLike } from "../../../db/escape-like";
import {
  hallsTable,
  sessionsTable,
  statesTable,
  venuesTable,
  type Hall,
  type Venue,
} from "../../../db/schemas";
import type {
  CreateHallBody,
  CreateVenueBody,
  VenueSort,
  VenueStatusFilter,
} from "../schemas/venue.schemas";

/** Drizzle wraps the driver error in DrizzleQueryError.cause. */
function postgresError(
  error: unknown,
): { code?: unknown; constraint?: unknown } | null {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return typeof cause === "object" && cause !== null ? cause : null;
}

/** Name of the unique constraint/index a Postgres "unique_violation" (23505) hit, else null. */
function violatedUniqueConstraint(error: unknown): string | null {
  const cause = postgresError(error);
  return cause?.code === "23505" && typeof cause.constraint === "string"
    ? cause.constraint
    : null;
}

/** True for a Postgres "foreign_key_violation" (23503): a row still points at the one deleted. */
function isForeignKeyViolation(error: unknown): boolean {
  return postgresError(error)?.code === "23503";
}

/** Name of the foreign key a "foreign_key_violation" (23503) hit, else null. */
function violatedForeignKey(error: unknown): string | null {
  const cause = postgresError(error);
  return cause?.code === "23503" && typeof cause.constraint === "string"
    ? cause.constraint
    : null;
}

/** A venue row plus the name of its state (the table stores only the state's id). */
export type VenueWithState = Venue & { stateName: string | null };

/** One small lookup by primary key; a venue with no state (an old row) gets null. */
async function withStateName(venue: Venue): Promise<VenueWithState> {
  if (!venue.stateId) return { ...venue, stateName: null };
  const [state] = await db
    .select({ name: statesTable.name })
    .from(statesTable)
    .where(eq(statesTable.id, venue.stateId));
  return { ...venue, stateName: state?.name ?? null };
}

export type NewVenue = CreateVenueBody & {
  /** users.id of the admin who creates the venue (from the access token). */
  createdBy: string;
};

export type CreateVenueResult =
  | { ok: true; venue: VenueWithState; halls: Hall[] }
  /** Same name in the same city already exists (case-insensitive). */
  | { ok: false; reason: "VENUE_EXISTS" }
  /** No state has the chosen name. */
  | { ok: false; reason: "STATE_NOT_FOUND" };

export type SetHallsActiveResult =
  | { ok: true; venue: VenueWithState; halls: Hall[] }
  | {
      ok: false;
      reason: "VENUE_NOT_FOUND" | "VENUE_INACTIVE" | "HALL_NOT_FOUND";
    };

export type AddHallResult =
  | { ok: true; venue: VenueWithState; halls: Hall[] }
  | {
      ok: false;
      // HALL_EXISTS: the venue already has a hall with that name (case-insensitive).
      reason: "VENUE_NOT_FOUND" | "VENUE_INACTIVE" | "HALL_EXISTS";
    };

export type DeleteHallResult =
  | { ok: true; venue: VenueWithState; halls: Hall[] }
  | {
      ok: false;
      // LAST_HALL: a venue must keep at least one hall.
      // HALL_IN_USE: a session still points at the hall.
      reason:
        "VENUE_NOT_FOUND" | "HALL_NOT_FOUND" | "LAST_HALL" | "HALL_IN_USE";
    };

export const venueRepository = {
  /** Venue + all its halls in one transaction: either both are saved or nothing is. */
  async createVenue(input: NewVenue): Promise<CreateVenueResult> {
    // The body carries the state's name; the table stores its id. States are static reference
    // data, so this read can sit outside the transaction (the foreign key below still guards it).
    const [state] = await db
      .select({ id: statesTable.id })
      .from(statesTable)
      .where(sql`lower(${statesTable.name}) = ${input.state.toLowerCase()}`);
    if (!state) return { ok: false, reason: "STATE_NOT_FOUND" };

    try {
      const row = await db.transaction(async (tx) => {
        const [venue] = await tx
          .insert(venuesTable)
          .values({
            name: input.name,
            addressLine: input.addressLine,
            city: input.city,
            stateId: state.id,
            postalCode: input.postalCode,
            country: input.country,
            timezone: input.timezone,
            // numeric columns take strings in Drizzle.
            latitude: input.latitude?.toString(),
            longitude: input.longitude?.toString(),
            createdBy: input.createdBy,
          })
          .returning();
        if (!venue) throw new Error("venues insert returned no row");

        // One INSERT for every hall; the array position becomes the board column order.
        const halls = await tx
          .insert(hallsTable)
          .values(
            input.halls.map((hall, index) => ({
              venueId: venue.id,
              name: hall.name,
              capacity: hall.capacity,
              sortOrder: index,
            })),
          )
          .returning();

        return { venue, halls };
      });
      return {
        ok: true as const,
        halls: row.halls,
        venue: await withStateName(row.venue),
      };
    } catch (error) {
      // Two admins adding the same venue at once: the DB stops the second one.
      // Any other failure is not the caller's fault: let it be a 500.
      if (violatedUniqueConstraint(error) === "venues_name_city_unique")
        return { ok: false, reason: "VENUE_EXISTS" };
      // The state was removed between the lookup above and the insert: the foreign key refuses it.
      if (violatedForeignKey(error) === "venues_state_id_states_id_fk")
        return { ok: false, reason: "STATE_NOT_FOUND" };
      throw error;
    }
  },

  /**
   * One page of venues with their hall counts, optionally searched and/or filtered by status,
   * plus the matching total. Returns every venue, active or not: the service decides which
   * status a guest may see.
   */
  async listVenues(params: {
    /** Matches the venue name or the city. */
    search?: string;
    status?: VenueStatusFilter;
    /** The state's name, compared ignoring case. */
    state?: string;
    sort: VenueSort;
    /** Count only the halls that are on (what a guest can see), not every hall. */
    onlyActiveHalls?: boolean;
    limit: number;
    offset: number;
  }) {
    // Contains-match, case-insensitive. The value is sent as a bound parameter (never pasted
    // into SQL), and % and _ in it are escaped so they search for themselves.
    const pattern = params.search
      ? `%${escapeLike(params.search)}%`
      : undefined;
    // and() skips undefined parts; with none it is undefined = no WHERE.
    const where = and(
      pattern
        ? or(ilike(venuesTable.name, pattern), ilike(venuesTable.city, pattern))
        : undefined,
      params.status
        ? eq(venuesTable.isActive, params.status === "active")
        : undefined,
      // Matched on the joined state's name (both queries below join `states`). A venue with no
      // state never matches, and a name that is no state matches nothing.
      params.state
        ? sql`lower(${statesTable.name}) = ${params.state.toLowerCase()}`
        : undefined,
    );

    // One row per venue with its halls counted: the table shows the numbers without loading
    // every hall. A venue always has halls, but the LEFT JOIN below keeps one that lost them.
    const hallStats = db
      .select({
        venueId: hallsTable.venueId,
        hallCount: sql<number>`count(*)::int`.as("hall_count"),
        hallsOn:
          sql<number>`(count(*) filter (where ${hallsTable.isActive}))::int`.as(
            "halls_on",
          ),
        totalSeats:
          sql<number>`coalesce(sum(${hallsTable.capacity}), 0)::int`.as(
            "total_seats",
          ),
      })
      .from(hallsTable)
      .where(params.onlyActiveHalls ? eq(hallsTable.isActive, true) : undefined)
      .groupBy(hallsTable.venueId)
      .as("hall_stats");

    const hallCount = sql<number>`coalesce(${hallStats.hallCount}, 0)`;
    const lowerName = sql`lower(${venuesTable.name})`;
    // id breaks ties, so paging never shows a row twice or skips one.
    const orderBy =
      params.sort === "newest"
        ? [desc(venuesTable.createdAt), desc(venuesTable.id)]
        : params.sort === "halls"
          ? [desc(hallCount), asc(lowerName), asc(venuesTable.id)]
          : [asc(lowerName), asc(venuesTable.id)];

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: venuesTable.id,
          name: venuesTable.name,
          addressLine: venuesTable.addressLine,
          city: venuesTable.city,
          state: statesTable.name,
          country: venuesTable.country,
          timezone: venuesTable.timezone,
          isActive: venuesTable.isActive,
          hallCount,
          hallsOn: sql<number>`coalesce(${hallStats.hallsOn}, 0)`,
          totalSeats: sql<number>`coalesce(${hallStats.totalSeats}, 0)`,
        })
        .from(venuesTable)
        .leftJoin(statesTable, eq(statesTable.id, venuesTable.stateId))
        .leftJoin(hallStats, eq(hallStats.venueId, venuesTable.id))
        .where(where)
        .orderBy(...orderBy)
        .limit(params.limit)
        .offset(params.offset),
      // Same where as the page, so `total` counts exactly the matches (no hall join needed;
      // the states join is needed because the where may filter on the state's name).
      db
        .select({ total: count() })
        .from(venuesTable)
        .leftJoin(statesTable, eq(statesTable.id, venuesTable.stateId))
        .where(where),
    ]);
    return { rows, total };
  },

  /**
   * One venue with its halls (the list only; a single hall's detail is a separate query).
   * Returns everything, active or not: the service decides what a guest may see.
   */
  async getVenueById(
    venueId: string,
  ): Promise<{ venue: VenueWithState; halls: Hall[] } | null> {
    const [row] = await db
      .select({ venue: venuesTable, stateName: statesTable.name })
      .from(venuesTable)
      .leftJoin(statesTable, eq(statesTable.id, venuesTable.stateId))
      .where(eq(venuesTable.id, venueId));
    if (!row) return null;
    const venue = { ...row.venue, stateName: row.stateName };

    // Same order as the schedule board columns; name breaks ties so the order is stable.
    const halls = await db
      .select()
      .from(hallsTable)
      .where(eq(hallsTable.venueId, venueId))
      .orderBy(asc(hallsTable.sortOrder), asc(hallsTable.name));

    return { venue, halls };
  },

  /**
   * One hall, only if it belongs to the given venue (a hall id from another venue is "not found").
   * Returns it active or not: the service decides what a guest may see.
   */
  async getHallById(
    venueId: string,
    hallId: string,
  ): Promise<{ venue: Venue; hall: Hall } | null> {
    const [row] = await db
      .select({ venue: venuesTable, hall: hallsTable })
      .from(hallsTable)
      .innerJoin(venuesTable, eq(hallsTable.venueId, venuesTable.id))
      .where(and(eq(hallsTable.id, hallId), eq(hallsTable.venueId, venueId)));

    return row ?? null;
  },

  /**
   * Activate or deactivate a venue. Returns null when the venue does not exist.
   * Deactivating also deactivates all its halls in the same transaction, so "venue inactive but
   * a hall still active" can never be stored. Activating activates no halls by default (the table
   * cannot tell which halls were deactivated on purpose, e.g. for renovation): pass
   * `activateHalls: "all"` to activate them all, or use setHallsActive for specific ones.
   */
  async setVenueActive(
    venueId: string,
    isActive: boolean,
    activateHalls: "all" | "none",
  ): Promise<{ venue: VenueWithState; halls: Hall[] } | null> {
    const result = await db.transaction(async (tx) => {
      const [venue] = await tx
        .update(venuesTable)
        .set({ isActive })
        .where(eq(venuesTable.id, venueId))
        .returning();
      if (!venue) return null;

      if (!isActive || activateHalls === "all") {
        await tx
          .update(hallsTable)
          .set({ isActive })
          .where(eq(hallsTable.venueId, venueId));
      }

      const halls = await tx
        .select()
        .from(hallsTable)
        .where(eq(hallsTable.venueId, venueId))
        .orderBy(asc(hallsTable.sortOrder), asc(hallsTable.name));

      return { venue, halls };
    });
    if (!result) return null;
    return { halls: result.halls, venue: await withStateName(result.venue) };
  },

  /**
   * Turn halls of one venue on or off: every hall ("all") or the listed ids (one id = one hall).
   * The venue row is locked first, so a hall cannot be turned on while another request is
   * retiring the venue. A hall can only be turned on while its venue is active.
   */
  async setHallsActive(
    venueId: string,
    isActive: boolean,
    target: "all" | string[],
  ): Promise<SetHallsActiveResult> {
    return db.transaction(async (tx): Promise<SetHallsActiveResult> => {
      const [venue] = await tx
        .select()
        .from(venuesTable)
        .where(eq(venuesTable.id, venueId))
        .for("update");
      if (!venue) return { ok: false, reason: "VENUE_NOT_FOUND" };
      if (isActive && !venue.isActive)
        return { ok: false, reason: "VENUE_INACTIVE" };

      if (target !== "all") {
        // Every id must be a hall of THIS venue, or the request is refused as a whole.
        const found = await tx
          .select({ id: hallsTable.id })
          .from(hallsTable)
          .where(
            and(
              eq(hallsTable.venueId, venueId),
              inArray(hallsTable.id, target),
            ),
          );
        if (found.length !== target.length)
          return { ok: false, reason: "HALL_NOT_FOUND" };
      }

      await tx
        .update(hallsTable)
        .set({ isActive })
        .where(
          target === "all"
            ? eq(hallsTable.venueId, venueId)
            : and(
                eq(hallsTable.venueId, venueId),
                inArray(hallsTable.id, target),
              ),
        );

      const halls = await tx
        .select()
        .from(hallsTable)
        .where(eq(hallsTable.venueId, venueId))
        .orderBy(asc(hallsTable.sortOrder), asc(hallsTable.name));

      return { ok: true, venue: await withStateName(venue), halls };
    });
  },

  /**
   * Add one hall to an existing venue, at the end of the board (highest sortOrder + 1).
   * The venue row is locked first: two admins adding at once queue up, so they cannot get the same
   * sortOrder, and the venue cannot be retired between the check and the insert. A hall starts
   * active, so the venue must be active too (never "venue off, hall on").
   */
  async addHall(
    venueId: string,
    input: CreateHallBody,
  ): Promise<AddHallResult> {
    try {
      return await db.transaction(async (tx): Promise<AddHallResult> => {
        const [venue] = await tx
          .select()
          .from(venuesTable)
          .where(eq(venuesTable.id, venueId))
          .for("update");
        if (!venue) return { ok: false, reason: "VENUE_NOT_FOUND" };
        if (!venue.isActive) return { ok: false, reason: "VENUE_INACTIVE" };

        const [last] = await tx
          .select({ value: max(hallsTable.sortOrder) })
          .from(hallsTable)
          .where(eq(hallsTable.venueId, venueId));

        await tx.insert(hallsTable).values({
          venueId,
          name: input.name,
          capacity: input.capacity,
          sortOrder: (last?.value ?? -1) + 1,
        });

        const halls = await tx
          .select()
          .from(hallsTable)
          .where(eq(hallsTable.venueId, venueId))
          .orderBy(asc(hallsTable.sortOrder), asc(hallsTable.name));

        return { ok: true, venue: await withStateName(venue), halls };
      });
    } catch (error) {
      // The unique index (venue, lower(name)) is the final guard against a duplicate name.
      if (violatedUniqueConstraint(error) === "halls_venue_name_unique")
        return { ok: false, reason: "HALL_EXISTS" };
      throw error;
    }
  },

  /**
   * Permanently delete one hall of a venue. Refused when it is the venue's last hall, or when any
   * session still uses it (sessions.hall_id is ON DELETE RESTRICT): retire the hall instead.
   * The venue row is locked first so two admins cannot each delete a "not last" hall at once and
   * leave the venue with none.
   */
  async deleteHall(venueId: string, hallId: string): Promise<DeleteHallResult> {
    try {
      return await db.transaction(async (tx): Promise<DeleteHallResult> => {
        const [venue] = await tx
          .select()
          .from(venuesTable)
          .where(eq(venuesTable.id, venueId))
          .for("update");
        if (!venue) return { ok: false, reason: "VENUE_NOT_FOUND" };

        const before = await tx
          .select({ id: hallsTable.id })
          .from(hallsTable)
          .where(eq(hallsTable.venueId, venueId));
        // A hall id from another venue is "not found" too.
        if (!before.some((hall) => hall.id === hallId))
          return { ok: false, reason: "HALL_NOT_FOUND" };
        if (before.length === 1) return { ok: false, reason: "LAST_HALL" };

        const [used] = await tx
          .select({ id: sessionsTable.id })
          .from(sessionsTable)
          .where(eq(sessionsTable.hallId, hallId))
          .limit(1);
        if (used) return { ok: false, reason: "HALL_IN_USE" };

        await tx.delete(hallsTable).where(eq(hallsTable.id, hallId));

        const halls = await tx
          .select()
          .from(hallsTable)
          .where(eq(hallsTable.venueId, venueId))
          .orderBy(asc(hallsTable.sortOrder), asc(hallsTable.name));

        return { ok: true, venue: await withStateName(venue), halls };
      });
    } catch (error) {
      // A session was given this hall between the check above and the DELETE (session writes do
      // not lock the venue): the foreign key still refuses it.
      if (isForeignKeyViolation(error))
        return { ok: false, reason: "HALL_IN_USE" };
      throw error;
    }
  },
};

export type VenueRepository = typeof venueRepository;
