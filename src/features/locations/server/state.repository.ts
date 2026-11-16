import "server-only";
import { asc, sql } from "drizzle-orm";
import { db } from "../../../db/dbClient";
import { statesTable } from "../../../db/schemas";

export const stateRepository = {
  /** Every state, A to Z (case-insensitive; id breaks ties so the order never changes). */
  async listStates() {
    return db
      .select()
      .from(statesTable)
      .orderBy(asc(sql`lower(${statesTable.name})`), asc(statesTable.id));
  },
};

export type StateRepository = typeof stateRepository;
