import { DrizzleQueryError } from "drizzle-orm";
import { HALL_OVERLAP_CONSTRAINT, isHallClashError } from "../hall-clash";

/** What the Postgres driver throws: an Error carrying the SQLSTATE code and the constraint name. */
const pgError = (code: string, constraint?: string) =>
  Object.assign(
    new Error("conflicting key value violates exclusion constraint"),
    {
      code,
      constraint,
    },
  );

/** Drizzle wraps the driver's error: the code and the constraint are on `cause`. */
const wrapped = (cause: Error) =>
  new DrizzleQueryError("insert into sessions ...", [], cause);

describe("isHallClashError", () => {
  it("recognises the database refusing an overlap in one hall (as Drizzle wraps it)", () => {
    expect(
      isHallClashError(wrapped(pgError("23P01", HALL_OVERLAP_CONSTRAINT))),
    ).toBe(true);
  });

  it("recognises the bare driver error too", () => {
    expect(isHallClashError(pgError("23P01", HALL_OVERLAP_CONSTRAINT))).toBe(
      true,
    );
  });

  it("is the constraint migration 0009 creates", () => {
    expect(HALL_OVERLAP_CONSTRAINT).toBe("sessions_no_hall_overlap");
  });

  it("ignores an exclusion violation of some other constraint", () => {
    expect(isHallClashError(wrapped(pgError("23P01", "other_exclusion")))).toBe(
      false,
    );
  });

  it("ignores other database errors, even on a constraint with that name", () => {
    expect(
      isHallClashError(wrapped(pgError("23505", HALL_OVERLAP_CONSTRAINT))),
    ).toBe(false); // unique violation
    expect(isHallClashError(wrapped(pgError("23503")))).toBe(false); // foreign key
  });

  it("ignores a Drizzle error with no cause, ordinary errors and non-errors", () => {
    expect(
      isHallClashError(new DrizzleQueryError("select 1", [], undefined)),
    ).toBe(false);
    expect(isHallClashError(new Error("boom"))).toBe(false);
    expect(isHallClashError(null)).toBe(false);
    expect(isHallClashError(undefined)).toBe(false);
    expect(isHallClashError("23P01")).toBe(false);
  });
});
