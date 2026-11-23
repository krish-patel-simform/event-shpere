import { DrizzleQueryError } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { readAccessTokenCookie } from "../../auth/server/auth-cookies";
import {
  resolveCurrentUser,
  type CurrentUser,
} from "../../auth/server/auth-session";
import { assertRateLimit } from "../rate-limit";
import {
  ConflictError,
  NotFoundError,
  ok,
  parseBody,
  parseQuery,
  RateLimitError,
  route,
  ServiceUnavailableError,
} from "..";

// The real guards run; only their inputs are faked. Mocking these two modules (with
// factories, so the real files are never loaded) keeps cookies, env and the DB out of a
// unit test.
jest.mock("../../auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
}));
jest.mock("../../auth/server/auth-session", () => ({
  resolveCurrentUser: jest.fn(),
}));
const mockReadAccessTokenCookie = jest.mocked(readAccessTokenCookie);
const mockResolveCurrentUser = jest.mocked(resolveCurrentUser);

// The limiter and Redis stay out of the test: only what route() asks of the limiter is checked.
jest.mock("../rate-limit", () => ({ assertRateLimit: jest.fn() }));
const mockAssertRateLimit = jest.mocked(assertRateLimit);

/** Simulates the request's access token: none, invalid (resolves to null), or a valid user. */
function signInAs(
  user: CurrentUser | null,
  token: string | undefined = "access-token",
) {
  mockReadAccessTokenCookie.mockResolvedValue(token);
  mockResolveCurrentUser.mockResolvedValue(user);
}

const noParams = { params: Promise.resolve({}) };

const admin: CurrentUser = {
  id: "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10",
  sessionId: "0b7c2d1e-3f4a-4b5c-8d6e-7f8091a2b3c4",
  role: "admin",
  permissions: new Set(["ORGANIZER_CREATE"]),
  firstName: "Admin",
  lastName: "User",
  email: "admin@example.com",
};

function get(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

beforeEach(() => {
  mockReadAccessTokenCookie.mockReset();
  mockResolveCurrentUser.mockReset();
  mockAssertRateLimit.mockReset();
});

describe("route()", () => {
  it("returns the handler's response with an x-request-id header", async () => {
    const GET = route({ auth: "public" }, async () => ok({ hello: "world" }));

    const res = await GET(get(), noParams);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: "world" } });
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("passes dynamic params through", async () => {
    const GET = route<{ id: string }>({ auth: "public" }, async ({ params }) =>
      ok(await params),
    );

    const res = await GET(get("http://localhost/api/test/42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(await res.json()).toEqual({ data: { id: "42" } });
  });

  it("maps a domain error to its status and envelope", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new NotFoundError("Organizer not found");
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Organizer not found" },
    });
  });

  it("keeps the rule-specific code of a ConflictError", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new ConflictError("EMAIL_TAKEN", "Email already in use");
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  it("tells a rate limited caller how long to wait, in the Retry-After header", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new RateLimitError("Slow down", 30);
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Slow down" },
    });
  });

  it("sends no Retry-After when the rate limit error does not know the wait (a cooldown)", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new RateLimitError("Wait a minute");
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("sends no Retry-After for any other domain error", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new NotFoundError("Organizer not found");
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(404);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new Error('relation "users" does not exist');
    });

    const res = await GET(get(), noParams);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    });
    expect(JSON.stringify(body)).not.toContain("relation");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("logs a failed query without its values, under the same request id the client gets", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new DrizzleQueryError(
        'insert into "users" ("email") values ($1)',
        ["ankit@speaker.test"],
        Object.assign(new Error("duplicate key"), {
          code: "23505",
          detail: "Key (email)=(ankit@speaker.test) already exists.",
        }),
      );
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(500);
    expect(log).toHaveBeenCalledTimes(1);
    const [line, described] = log.mock.calls[0];
    // The request id in the log line is the one in the response header.
    expect(line).toContain(`[${res.headers.get("x-request-id")}]`);
    expect(line).toContain("GET /api/test failed");
    // Nothing that was logged holds the user's data or the SQL.
    const everything = JSON.stringify(log.mock.calls);
    expect(everything).not.toContain("ankit@speaker.test");
    expect(everything).not.toContain("insert into");
    expect(described).toMatchObject({ dbCode: "23505" });
    log.mockRestore();
  });

  it("answers 503 + Retry-After when the database cannot take a connection, with a generic body", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new DrizzleQueryError(
        'select "email" from "users" where "email" = $1',
        ["ankit@speaker.test"],
        new Error("timeout exceeded when trying to connect"),
      );
    });

    const res = await GET(get(), noParams);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: "SERVICE_BUSY",
        message: "The service is busy, try again shortly",
      },
    });
    // Neither the response nor the log says what is down or holds the user's data.
    expect(JSON.stringify(body)).not.toMatch(/database|timeout|pool|users/i);
    expect(JSON.stringify(log.mock.calls)).not.toContain("ankit@speaker.test");
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("answers 503 + Retry-After, not 500, when Redis is down under a fail-closed limit (login)", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    // What ioredis throws once it gives up reaching Redis.
    const redisDown = Object.assign(
      new Error("Reached the max retries per request limit (which is 1)."),
      { name: "MaxRetriesPerRequestError" },
    );
    const POST = route({ auth: "public" }, async () => {
      throw redisDown;
    });

    const res = await POST(get(), noParams);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(body).toEqual({
      error: {
        code: "SERVICE_BUSY",
        message: "The service is busy, try again shortly",
      },
    });
    // The answer never says what is down.
    expect(JSON.stringify(body)).not.toMatch(/redis|retries/i);
    log.mockRestore();
  });

  it("keeps any other database failure a 500 with no Retry-After", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new DrizzleQueryError(
        "select 1",
        [],
        Object.assign(new Error('relation "users" does not exist'), {
          code: "42P01",
        }),
      );
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(500);
    expect(res.headers.get("Retry-After")).toBeNull();
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    log.mockRestore();
  });

  it("a ServiceUnavailableError that names its wait sends it as Retry-After", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new ServiceUnavailableError("CMS_UNAVAILABLE", "CMS is down", 12);
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("a ServiceUnavailableError with no wait sends no Retry-After", async () => {
    const GET = route({ auth: "public" }, async () => {
      throw new ServiceUnavailableError("CMS_UNAVAILABLE", "CMS is down");
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("a thrown value that is not an Error is a generic 500, and is not printed", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      // Some libraries throw plain strings or objects.
      throw "token=secret-value";
    });

    const res = await GET(get(), noParams);

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-value");
    expect(log.mock.calls[0][1]).toMatchObject({ name: "NonErrorThrown" });
    log.mockRestore();
  });

  it("logs nothing for an expected (domain) error: it is not a bug", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new NotFoundError("Organizer not found");
    });

    await GET(get(), noParams);

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("puts the request id in the header of an error response too", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const GET = route({ auth: "public" }, async () => {
      throw new Error("boom");
    });

    const res = await GET(get(), noParams);

    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    log.mockRestore();
  });
});

describe("route() auth", () => {
  it("never checks the session on a public route", async () => {
    const GET = route({ auth: "public" }, async () => ok(true));

    await GET(get(), noParams);

    expect(mockReadAccessTokenCookie).not.toHaveBeenCalled();
  });

  it("returns 401 when a signed-in route has no access token cookie", async () => {
    signInAs(null, undefined);
    const handler = jest.fn(async () => ok(true));
    const GET = route({ auth: "signed-in" }, handler);

    const res = await GET(get(), noParams);

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the access token or its session is no longer valid", async () => {
    signInAs(null);
    const handler = jest.fn(async () => ok(true));
    const GET = route({ auth: "signed-in" }, handler);

    const res = await GET(get(), noParams);

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when the role lacks the permission", async () => {
    signInAs(admin);
    const handler = jest.fn(async () => ok(true));
    const GET = route({ permission: ["ORGANIZER_VERIFY"] }, handler);

    const res = await GET(get(), noParams);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("with several permissions, returns 403 if any one is missing", async () => {
    signInAs(admin); // has ORGANIZER_CREATE only
    const handler = jest.fn(async () => ok(true));
    const GET = route(
      { permission: ["ORGANIZER_CREATE", "ORGANIZER_VERIFY"] },
      handler,
    );

    const res = await GET(get(), noParams);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("with several permissions, allows the user who has all of them", async () => {
    signInAs({
      ...admin,
      permissions: new Set(["ORGANIZER_CREATE", "ORGANIZER_VERIFY"]),
    });
    const GET = route(
      { permission: ["ORGANIZER_CREATE", "ORGANIZER_VERIFY"] },
      async () => ok(true),
    );

    const res = await GET(get(), noParams);

    expect(res.status).toBe(200);
  });

  it("passes the current user to the handler when the permission is granted", async () => {
    signInAs(admin);
    const GET = route(
      { permission: ["ORGANIZER_CREATE"] },
      async ({ currentUser }) => ok({ id: currentUser.id }),
    );

    const res = await GET(get(), noParams);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: admin.id } });
  });

  it("blocks a cross-site POST (CSRF) but allows same-origin and no-Origin requests", async () => {
    const POST = route({ auth: "public" }, async () => ok(true));

    const crossSite = await POST(
      post("{}", { origin: "https://evil.example" }),
      noParams,
    );
    const sameSite = await POST(
      post("{}", { origin: "http://localhost" }),
      noParams,
    );
    const postman = await POST(post("{}"), noParams);

    expect(crossSite.status).toBe(403);
    expect(sameSite.status).toBe(200);
    expect(postman.status).toBe(200);
  });
});

describe("route() rate limit", () => {
  const retryIn45 = () =>
    new RateLimitError("Too many requests, try again later", 45);

  it("limits a public read by the caller's IP: the first address of x-forwarded-for", async () => {
    const GET = route({ auth: "public" }, async () => ok(true));
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });

    await GET(req, noParams);

    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      "public-read-ip",
      "203.0.113.7",
    );
  });

  it("gives a public write the strict auth limit", async () => {
    const POST = route({ auth: "public" }, async () => ok(true));

    await POST(post("{}", { "x-forwarded-for": "203.0.113.7" }), noParams);

    expect(mockAssertRateLimit).toHaveBeenCalledWith("auth-ip", "203.0.113.7");
  });

  it("limits a signed-in read and a signed-in write by user id, each under its own policy", async () => {
    signInAs(admin);
    const GET = route({ auth: "signed-in" }, async () => ok(true));
    const POST = route({ auth: "signed-in" }, async () => ok(true));

    await GET(get(), noParams);
    await POST(post("{}"), noParams);

    expect(mockAssertRateLimit).toHaveBeenNthCalledWith(
      1,
      "user-read",
      admin.id,
    );
    expect(mockAssertRateLimit).toHaveBeenNthCalledWith(
      2,
      "user-write",
      admin.id,
    );
  });

  it("uses the policy a route names instead of the default", async () => {
    const POST = route({ auth: "public", rateLimit: "refresh-ip" }, async () =>
      ok(true),
    );

    await POST(post("{}", { "x-forwarded-for": "203.0.113.7" }), noParams);

    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      "refresh-ip",
      "203.0.113.7",
    );
  });

  it("refuses at compile time a policy of the wrong kind: a public route counts by IP, a signed-in one by user id", () => {
    // Checked by `pnpm typecheck`: each directive below must be an error, or the line fails.
    // @ts-expect-error a user policy on a public route
    route({ auth: "public", rateLimit: "user-write" }, async () => ok(true));
    // @ts-expect-error an IP policy on a signed-in route
    route({ auth: "signed-in", rateLimit: "auth-ip" }, async () => ok(true));
    // @ts-expect-error an IP policy on a permission route
    route({ permission: ["X"], rateLimit: "public-read-ip" }, async () =>
      ok(true),
    );
    // The right kinds compile.
    route({ auth: "public", rateLimit: "public-read-ip" }, async () =>
      ok(true),
    );
    route({ auth: "signed-in", rateLimit: "user-upload" }, async () =>
      ok(true),
    );
  });

  it("skips the limit when a route says none", async () => {
    const handler = jest.fn(async () => ok(true));
    const GET = route({ auth: "public", rateLimit: "none" }, handler);

    const res = await GET(get(), noParams);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });

  it("answers a refused request with a 429 and Retry-After, and never runs the handler", async () => {
    mockAssertRateLimit.mockRejectedValueOnce(retryIn45());
    const handler = jest.fn(async () => ok(true));
    const GET = route({ auth: "public" }, handler);

    const res = await GET(get(), noParams);

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks the user limit before the permission: a forbidden request is counted, and a refused one answers 429, not 403", async () => {
    signInAs(admin); // has ORGANIZER_CREATE only
    const handler = jest.fn(async () => ok(true));
    const GET = route({ permission: ["ORGANIZER_VERIFY"] }, handler);

    const forbidden = await GET(get(), noParams);

    expect(forbidden.status).toBe(403);
    expect(mockAssertRateLimit).toHaveBeenCalledWith("user-read", admin.id);

    mockAssertRateLimit.mockRejectedValueOnce(retryIn45());
    const limited = await GET(get(), noParams);

    expect(limited.status).toBe(429);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not count a request with no valid session", async () => {
    signInAs(null);
    const GET = route({ auth: "signed-in" }, async () => ok(true));

    const res = await GET(get(), noParams);

    expect(res.status).toBe(401);
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });

  it("does not count a cross-site request: it is refused before the limiter", async () => {
    const POST = route({ auth: "public" }, async () => ok(true));

    const res = await POST(
      post("{}", { origin: "https://evil.example" }),
      noParams,
    );

    expect(res.status).toBe(403);
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });

  it("fails the request, never lets it through, when the limiter itself fails", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    mockAssertRateLimit.mockRejectedValueOnce(new Error("Redis is down"));
    const handler = jest.fn(async () => ok(true));
    const POST = route({ auth: "public" }, handler);

    const res = await POST(post("{}"), noParams);

    expect(res.status).toBe(500);
    expect(handler).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("parseBody()", () => {
  const schema = z.object({ email: z.email() });
  const POST = route({ auth: "public" }, async ({ req }) =>
    ok(await parseBody(req, schema)),
  );

  it("returns the parsed body", async () => {
    const res = await POST(post('{"email":"a@b.co"}'), noParams);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { email: "a@b.co" } });
  });

  it("turns malformed JSON into a 400, not a 500", async () => {
    const res = await POST(post("{not json"), noParams);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns field errors when the body fails the schema", async () => {
    const res = await POST(post('{"email":"nope"}'), noParams);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.details.fieldErrors.email).toBeDefined();
  });
});

describe("parseQuery()", () => {
  it("coerces query strings with the schema", async () => {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
    });
    const GET = route({ auth: "public" }, async ({ req }) =>
      ok(parseQuery(req, schema)),
    );

    const res = await GET(get("http://localhost/api/test?page=3"), noParams);

    expect(await res.json()).toEqual({ data: { page: 3 } });
  });
});
