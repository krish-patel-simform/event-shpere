import type { GetUsersQuery } from "../schemas/users.schema";

export type UserRole = NonNullable<GetUsersQuery["role"]>;
export type AccountStatus = NonNullable<GetUsersQuery["status"]>;

/** The tabs above the list: each one is a filter on the role or on the status. */
export type UserTabKey =
  "all" | "user" | "speaker" | "organizer" | "admin" | "suspended";
