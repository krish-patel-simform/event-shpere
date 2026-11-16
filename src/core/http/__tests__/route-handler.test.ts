import { DrizzleQueryError } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { readAccessTokenCookie } from "../../auth/server/auth-cookies";
import {
  resolveCurrentUser,
  type CurrentUser,
} from "../../auth/server/auth-session";
import {
  ConflictError,
  NotFoundError,
  ok,
  parseBody,
  parseQuery,
  route,
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
