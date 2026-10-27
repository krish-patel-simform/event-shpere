import {
  getUsersQueryParams,
  getUsersResponseSchema,
  userParamSchema,
  userStatusResponseSchema,
} from "../users.schema";

describe("getUsersQueryParams", () => {
  it("with nothing in the URL: page 1, 10 per page, newest first, no filters", () => {
    expect(getUsersQueryParams.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      sort: "newest",
    });
  });

  it("reads numbers from the query string (they arrive as text) and the filters", () => {
    expect(
      getUsersQueryParams.parse({
        page: "3",
        pageSize: "8",
        role: "speaker",
        status: "suspended",
        search: "  meera  ",
        sort: "name",
      }),
    ).toEqual({
      page: 3,
      pageSize: 8,
      role: "speaker",
      status: "suspended",
      search: "meera",
      sort: "name",
    });
  });

  it.each([
    ["role", "guest"],
    ["role", "superuser"],
    ["status", "banned"],
    ["sort", "password_hash"],
    ["sort", "createdAt; DROP TABLE users"],
    ["page", "0"],
    ["page", "abc"],
    ["pageSize", "0"],
    ["pageSize", "51"],
    ["search", "x".repeat(101)],
  ])("refuses %s=%j", (key, value) => {
    expect(getUsersQueryParams.safeParse({ [key]: value }).success).toBe(false);
  });

  it("accepts the largest page size, 50", () => {
    expect(getUsersQueryParams.parse({ pageSize: "50" }).pageSize).toBe(50);
  });
});

describe("getUsersResponseSchema", () => {
  const item = {
    id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
    firstName: "Rahul",
    lastName: "Sharma",
    email: "rahul.sharma@example.com",
    role: "user",
    status: "active",
    emailVerified: true,
    createdAt: "2026-10-11T08:00:00.000Z",
    updatedAt: "2026-10-12T08:00:00.000Z",
  };

  it("accepts a list of rows, a missing role (null) included", () => {
    expect(
      getUsersResponseSchema.parse([item, { ...item, role: null }]),
    ).toHaveLength(2);
  });

  it("drops a password hash if one ever reaches it", () => {
    const [row] = getUsersResponseSchema.parse([
      { ...item, passwordHash: "secret" },
    ]);

    expect(row).not.toHaveProperty("passwordHash");
  });
});

describe("userParamSchema", () => {
  it("accepts a uuid", () => {
    const userId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
    expect(userParamSchema.parse({ userId })).toEqual({ userId });
  });

  it.each(["", "123", "not-a-uuid", "8c1f4f6e-2f4b-4c43-9a59"])(
    "refuses %j",
    (userId) => {
      expect(userParamSchema.safeParse({ userId }).success).toBe(false);
    },
  );
});

describe("userStatusResponseSchema", () => {
  const row = {
    id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
    firstName: "Rahul",
    lastName: "Sharma",
    status: "suspended",
  };

  it("keeps id, names and status", () => {
    expect(userStatusResponseSchema.parse(row)).toEqual(row);
  });

  it("drops anything else: a password hash or email can never reach the response", () => {
    const result = userStatusResponseSchema.parse({
      ...row,
      passwordHash: "secret",
      email: "rahul@example.com",
    });

    expect(result).toEqual(row);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("email");
  });

  it("refuses a status that does not exist", () => {
    expect(
      userStatusResponseSchema.safeParse({ ...row, status: "banned" }).success,
    ).toBe(false);
  });
});
