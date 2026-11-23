import { DrizzleQueryError } from "drizzle-orm";
import { isDatabaseUnavailable } from "../database-unavailable";

const withCode = (message: string, code: string) =>
  Object.assign(new Error(message), { code });

// What Drizzle throws when a query fails: the driver's error is the `cause`.
const failedQuery = (cause: Error) =>
  new DrizzleQueryError("select 1", [], cause);

describe("isDatabaseUnavailable", () => {
  it.each([
    [
      "the pool waited too long for a free connection",
      "timeout exceeded when trying to connect",
    ],
    [
      "the connection timed out while opening",
      "Connection terminated due to connection timeout",
    ],
    ["the connection dropped", "Connection terminated unexpectedly"],
  ])("is true when %s", (_name, message) => {
    expect(isDatabaseUnavailable(new Error(message))).toBe(true);
  });

  it.each([
    ["53300", "too many connections"],
    ["57P01", "server shutting down"],
    ["57P03", "not accepting connections yet"],
    ["08006", "connection failure (class 08)"],
    ["ECONNREFUSED", "nobody is listening"],
    ["ECONNRESET", "the connection was reset"],
    ["ETIMEDOUT", "no answer in time"],
  ])("is true for the code %s (%s)", (code, message) => {
    expect(isDatabaseUnavailable(withCode(message, code))).toBe(true);
  });

  it("is true when Redis is unreachable (ioredis gave up after its retries)", () => {
    // ioredis does not export this class; it is told apart by its name. No `code` on it.
    const redisDown = Object.assign(
      new Error(
        'Reached the max retries per request limit (which is 1). Refer to "maxRetriesPerRequest" option for details.',
      ),
      { name: "MaxRetriesPerRequestError" },
    );

    expect(isDatabaseUnavailable(redisDown)).toBe(true);
    // A fail-closed policy may wrap it in another error on the way up.
    expect(
      isDatabaseUnavailable(
        new Error("rate limit failed", { cause: redisDown }),
      ),
    ).toBe(true);
  });

  it("looks inside a Drizzle error's cause", () => {
    const error = failedQuery(
      new Error("timeout exceeded when trying to connect"),
    );

    expect(isDatabaseUnavailable(error)).toBe(true);
  });

  it("looks through nested causes (the pool wraps its own cause)", () => {
    const inner = withCode("socket hang up", "ECONNRESET");
    const middle = new Error(
      "Connection terminated due to connection timeout",
      { cause: inner },
    );

    expect(isDatabaseUnavailable(failedQuery(middle))).toBe(true);
    expect(
      isDatabaseUnavailable(
        new Error("outer", { cause: new Error("mid", { cause: inner }) }),
      ),
    ).toBe(true);
  });

  it.each([
    ["a unique violation", withCode("duplicate key", "23505")],
    ["a missing table", withCode('relation "users" does not exist', "42P01")],
    ["a plain bug", new Error("Cannot read properties of undefined")],
  ])("is false for %s, even inside a Drizzle error", (_name, cause) => {
    expect(isDatabaseUnavailable(cause)).toBe(false);
    expect(isDatabaseUnavailable(failedQuery(cause))).toBe(false);
  });

  it("does not match a query whose text only mentions the words", () => {
    const error = new DrizzleQueryError(
      "select * from notes where body = $1",
      ["timeout exceeded when trying to connect"],
      new Error("syntax error"),
    );

    expect(isDatabaseUnavailable(error)).toBe(false);
  });

  it("is false for values that are not errors", () => {
    expect(
      isDatabaseUnavailable("timeout exceeded when trying to connect"),
    ).toBe(false);
    expect(isDatabaseUnavailable({ code: "ECONNREFUSED" })).toBe(false);
    expect(isDatabaseUnavailable(undefined)).toBe(false);
  });

  it("stops on a cause loop instead of running forever", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;

    expect(isDatabaseUnavailable(a)).toBe(false);
  });
});
