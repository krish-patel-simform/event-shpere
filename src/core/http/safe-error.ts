import { DrizzleQueryError } from "drizzle-orm";

/** A text field of an unknown value (the driver's error is not typed here), or undefined. */
function textField(source: unknown, key: string): string | undefined {
  if (typeof source !== "object" || source === null) return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

const MAX_STACK_FRAMES = 10;

export type SafeErrorDescription = {
  name: string;
  message: string;
  /** Postgres error code (SQLSTATE), only for a failed database query. */
  dbCode?: string;
  table?: string;
  constraint?: string;
  frames: string[];
};

/**
 * What is safe to log or send to an error tracker: what kind of failure and where, never the
 * data. A Drizzle error's message is "Failed query: <sql> params: <values>", and the
 * Postgres `detail` repeats the values ("Key (email)=(a@b.com) already exists"): both hold
 * user data, so neither is copied. The stack's first lines repeat the message, so only its
 * "at ..." lines are kept.
 */
export function describeError(error: unknown): SafeErrorDescription {
  // Whatever was thrown (a string, an object) may hold user data: say only that it happened.
  if (!(error instanceof Error)) {
    return {
      name: "NonErrorThrown",
      message: "A value that is not an Error was thrown",
      frames: [],
    };
  }

  const isQueryError = error instanceof DrizzleQueryError;
  return {
    name: error.name,
    message: isQueryError ? "Database query failed" : error.message,
    // The driver's own error is the cause: its SQLSTATE code (23505 = unique violation),
    // table and constraint name the problem without the values.
    ...(isQueryError && {
      dbCode: textField(error.cause, "code"),
      table: textField(error.cause, "table"),
      constraint: textField(error.cause, "constraint"),
    }),
    frames: (error.stack ?? "")
      .split("\n")
      .filter((line) => line.trimStart().startsWith("at "))
      .slice(0, MAX_STACK_FRAMES),
  };
}
