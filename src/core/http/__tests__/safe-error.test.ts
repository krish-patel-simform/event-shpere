import { DrizzleQueryError } from "drizzle-orm";
import { describeError } from "../safe-error";

const email = "ankit@speaker.test";

/** What the pg driver throws for a duplicate email: the detail repeats the value. */
function pgUniqueViolation() {
  return Object.assign(
    new Error(
      `duplicate key value violates unique constraint "users_email_key"`,
    ),
    {
      code: "23505",
      table: "users",
      constraint: "users_email_key",
      detail: `Key (email)=(${email}) already exists.`,
    },
  );
}

function failedInsert() {
  return new DrizzleQueryError(
    'insert into "users" ("first_name", "email") values ($1, $2)',
    ["Ankit", email],
    pgUniqueViolation(),
  );
}

describe("describeError", () => {
  it("never contains the values of a failed query: not in the message, the params or the detail", () => {
    const described = JSON.stringify(describeError(failedInsert()));

    expect(described).not.toContain(email);
    expect(described).not.toContain("Ankit");
    expect(described).not.toContain("insert into");
    expect(described).not.toContain("already exists");
  });

  it("still says what went wrong: the error type, the Postgres code, the table and the constraint", () => {
    expect(describeError(failedInsert())).toMatchObject({
      name: "Error",
      message: "Database query failed",
      dbCode: "23505",
      table: "users",
      constraint: "users_email_key",
    });
  });

  it("keeps only the stack frames, so the failing code can be found", () => {
    const { frames } = describeError(failedInsert());

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.length).toBeLessThanOrEqual(10);
    expect(frames.every((line) => line.trimStart().startsWith("at "))).toBe(
      true,
    );
  });

  it("keeps the message of an ordinary error", () => {
    expect(describeError(new TypeError("x is not a function"))).toMatchObject({
      name: "TypeError",
      message: "x is not a function",
    });
  });

  it("copes with an error that has no stack trace", () => {
    const error = new Error("boom");
    error.stack = undefined;

    expect(describeError(error)).toMatchObject({
      message: "boom",
      frames: [],
    });
  });

  it("keeps a custom error class's name, so the kind of failure is still visible", () => {
    class TimeoutError extends Error {
      name = "TimeoutError";
    }

    expect(
      describeError(new TimeoutError("upstream took too long")),
    ).toMatchObject({
      name: "TimeoutError",
      message: "upstream took too long",
    });
  });

  it("has no database fields for an ordinary error", () => {
    expect(describeError(new Error("boom"))).not.toHaveProperty("dbCode");
  });

  it("does not print whatever was thrown when it is not an Error", () => {
    for (const thrown of [`password=${email}`, { email }, undefined]) {
      const described = describeError(thrown);

      expect(described.name).toBe("NonErrorThrown");
      expect(JSON.stringify(described)).not.toContain(email);
      expect(described.frames).toEqual([]);
    }
  });

  it("copes with a query error whose cause is missing or not an object", () => {
    const bare = new DrizzleQueryError("select 1", [], undefined);

    expect(describeError(bare)).toMatchObject({
      message: "Database query failed",
    });
    expect(describeError(bare).dbCode).toBeUndefined();
  });
});
