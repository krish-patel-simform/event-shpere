import { organizerQuerySchema } from "../organizer.schemas";

describe("organizerQuerySchema", () => {
  it("with only the page size: page 1, newest first, no filters", () => {
    expect(organizerQuerySchema.parse({ pageSize: "10" })).toEqual({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });
  });

  it("reads every filter from the query string (it arrives as text)", () => {
    expect(
      organizerQuerySchema.parse({
        page: "2",
        pageSize: "10",
        verification: "pending",
        search: "  harbor  ",
        emailVerified: "false",
        sort: "oldest",
      }),
    ).toEqual({
      page: 2,
      pageSize: 10,
      verification: "pending",
      search: "harbor",
      emailVerified: false,
      sort: "oldest",
    });
  });

  it("emailVerified=false means false, not true (z.coerce.boolean would get this wrong)", () => {
    expect(
      organizerQuerySchema.parse({ pageSize: "10", emailVerified: "false" })
        .emailVerified,
    ).toBe(false);
    expect(
      organizerQuerySchema.parse({ pageSize: "10", emailVerified: "true" })
        .emailVerified,
    ).toBe(true);
  });

  it.each([
    ["emailVerified", "yes"],
    ["emailVerified", "1"],
    ["verification", "approved"],
    ["sort", "email"],
    ["sort", "created_at; drop table users"],
  ])("rejects %s=%s", (key, value) => {
    expect(
      organizerQuerySchema.safeParse({ pageSize: "10", [key]: value }).success,
    ).toBe(false);
  });

  it("rejects a search longer than 100 characters", () => {
    expect(
      organizerQuerySchema.safeParse({
        pageSize: "10",
        search: "a".repeat(101),
      }).success,
    ).toBe(false);
  });

  it("still needs a page size, and caps it at 50", () => {
    expect(organizerQuerySchema.safeParse({}).success).toBe(false);
    expect(organizerQuerySchema.safeParse({ pageSize: "51" }).success).toBe(
      false,
    );
  });
});
