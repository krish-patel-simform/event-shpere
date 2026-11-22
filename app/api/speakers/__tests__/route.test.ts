import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import { ConflictError } from "@/src/core/http";
import { speakerService } from "@/src/features/speakers/server";
import {
  ananya,
  createdSpeaker,
  meera,
} from "@/src/features/speakers/__fixtures__/speakers";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  userWith,
  users,
} from "../../__fixtures__/route-test";
import { GET, POST } from "../route";

jest.mock("@/src/core/auth/server/auth-cookies", () => ({
  readAccessTokenCookie: jest.fn(),
  readRefreshTokenCookie: jest.fn(),
  clearAuthCookies: jest.fn(),
  writeAuthCookies: jest.fn(),
}));
jest.mock("@/src/core/auth/server/auth-session", () => ({
  ...jest.requireActual("@/src/core/auth/server/auth-session"),
  resolveCurrentUser: jest.fn(),
}));
jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
// The service's rules (CMS, invite email, who may invite) have their own tests: here it is faked.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { listSpeakers: jest.fn(), createSpeaker: jest.fn() },
}));
const service = jest.mocked(speakerService);

const PATH = "/api/speakers";
const IP = "203.0.113.7";

beforeEach(() => {
  resetRouteMocks();
  signInAs(null);
});
afterEach(() => jest.restoreAllMocks());

describe("GET /api/speakers", () => {
  const meta = { page: 1, pageSize: 5, total: 2 };

  beforeEach(() => {
    service.listSpeakers.mockResolvedValue({ items: [ananya, meera], meta });
  });

  it("answers a guest a page of speakers that no cache may keep", async () => {
    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [ananya, meera], meta });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Cookie");
  });

  it("asks the service with the default paging and without the manage view for a guest", async () => {
    await call(GET, "GET", PATH);

    expect(service.listSpeakers).toHaveBeenCalledWith(
      { page: 1, pageSize: 5 },
      { canManage: false },
    );
  });

  it("hands the service the parsed query: numbers, a trimmed search and distinct ids", async () => {
    const other = "6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d09";

    await call(GET, "GET", PATH, {
      query: {
        page: "2",
        pageSize: "10",
        search: "  ananya ",
        ids: `${ananya.id}, ${ananya.id},${other}`,
      },
    });

    expect(service.listSpeakers).toHaveBeenCalledWith(
      { page: 2, pageSize: 10, search: "ananya", ids: [ananya.id, other] },
      { canManage: false },
    );
  });

  it("gives someone who manages every speaker the manage view, with each account's state", async () => {
    signInAs(users.admin);
    const pending = { ...meera, accountStatus: "pending" as const };
    service.listSpeakers.mockResolvedValue({ items: [pending], meta });

    const res = await call(GET, "GET", PATH);

    expect(service.listSpeakers).toHaveBeenCalledWith(expect.anything(), {
      canManage: true,
    });
    expect(await body(res)).toEqual({ data: [pending], meta });
  });

  it("does not give an organizer the manage view (no SPEAKER_MANAGE_ALL)", async () => {
    signInAs(users.organizer);

    await call(GET, "GET", PATH);

    expect(service.listSpeakers).toHaveBeenCalledWith(expect.anything(), {
      canManage: false,
    });
  });

  it.each([
    ["a page below 1", { page: "0" }],
    ["a page size above 50", { pageSize: "51" }],
    ["an empty id list", { ids: "" }],
    ["an id that is not a uuid", { ids: `${ananya.id},nope` }],
    ["a search over 100 characters", { search: "a".repeat(101) }],
  ])("refuses %s (400) without asking the service", async (_name, query) => {
    const res = await call(GET, "GET", PATH, { query });

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.listSpeakers).not.toHaveBeenCalled();
  });

  it("counts a guest against the public read limit by IP", async () => {
    await call(GET, "GET", PATH, { headers: { "x-forwarded-for": IP } });

    expect(assertRateLimit).toHaveBeenCalledWith("public-read-ip", IP);
  });

  it("answers 429 with Retry-After when the read limit is reached", async () => {
    rateLimited();

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.listSpeakers).not.toHaveBeenCalled();
  });

  it("drops fields that are not in the public contract (an email never leaks)", async () => {
    service.listSpeakers.mockResolvedValue({
      items: [{ ...ananya, email: "ananya@example.com" } as never],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ data: [ananya], meta });
  });

  it("never answers a speaker whose photo link is not http(s) (500)", async () => {
    service.listSpeakers.mockResolvedValue({
      items: [
        {
          ...ananya,
          profile: {
            ...ananya.profile,
            photo: {
              url: "javascript:alert(1)",
              alt: "x",
              width: null,
              height: null,
            },
          },
        } as never,
      ],
      meta,
    });

    const res = await call(GET, "GET", PATH);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await body(res))).not.toContain("javascript:");
  });
});

describe("POST /api/speakers", () => {
  const valid = {
    firstName: " Sneha ",
    lastName: "Desai",
    email: " Sneha.Desai@Example.com ",
  };
  const send = (sent: unknown, headers?: Record<string, string>) =>
    call(POST, "POST", PATH, { body: sent, headers });

  beforeEach(() => {
    signInAs(users.organizer);
    service.createSpeaker.mockResolvedValue(createdSpeaker);
  });

  it("invites the speaker: 201 with the new account", async () => {
    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ data: createdSpeaker });
  });

  it("hands the service the trimmed names, the lower-cased email and the inviter", async () => {
    await send(valid);

    expect(service.createSpeaker).toHaveBeenCalledWith(
      {
        firstName: "Sneha",
        lastName: "Desai",
        email: "sneha.desai@example.com",
      },
      users.organizer,
    );
  });

  it("lets an admin invite too", async () => {
    signInAs(users.admin);

    const res = await send(valid);

    expect(res.status).toBe(201);
    expect(service.createSpeaker).toHaveBeenCalledWith(
      expect.anything(),
      users.admin,
    );
  });

  it("ignores fields the server sets itself (slug, status)", async () => {
    await send({ ...valid, slug: "chosen", status: "active" });

    expect(service.createSpeaker).toHaveBeenCalledWith(
      {
        firstName: "Sneha",
        lastName: "Desai",
        email: "sneha.desai@example.com",
      },
      users.organizer,
    );
  });

  it.each([
    ["no first name", { ...valid, firstName: undefined }],
    ["a blank last name", { ...valid, lastName: "   " }],
    ["an email that is not one", { ...valid, email: "sneha" }],
    [
      "a first name over 100 characters",
      { ...valid, firstName: "a".repeat(101) },
    ],
  ])("refuses %s (400) without asking the service", async (_name, sent) => {
    const res = await send(sent);

    expect(res.status).toBe(400);
    expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
    expect(service.createSpeaker).not.toHaveBeenCalled();
  });

  it("refuses a guest (401)", async () => {
    signInAs(null);

    const res = await send(valid);

    expect(res.status).toBe(401);
    expect(service.createSpeaker).not.toHaveBeenCalled();
  });

  it("refuses a user without SPEAKER_CREATE (403)", async () => {
    signInAs(users.user);

    const res = await send(valid);

    expect(res.status).toBe(403);
    expect(service.createSpeaker).not.toHaveBeenCalled();
  });

  it("needs only SPEAKER_CREATE", async () => {
    signInAs(userWith([PERMISSION.SPEAKER_CREATE]));

    const res = await send(valid);

    expect(res.status).toBe(201);
  });

  it("blocks a request from another site (403) before reading anything", async () => {
    const res = await send(valid, { origin: "https://evil.example" });

    expect(res.status).toBe(403);
    expect(service.createSpeaker).not.toHaveBeenCalled();
  });

  it("passes on a 409 SPEAKER_EXISTS with the existing speaker", async () => {
    const details = {
      speaker: {
        id: createdSpeaker.id,
        firstName: "Sneha",
        lastName: "Desai",
        email: "sneha.desai@example.com",
        slug: createdSpeaker.slug,
        status: "pending",
      },
    };
    service.createSpeaker.mockRejectedValue(
      new ConflictError(
        "SPEAKER_EXISTS",
        "This speaker is already invited",
        details,
      ),
    );

    const res = await send(valid);

    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({
      error: {
        code: "SPEAKER_EXISTS",
        message: "This speaker is already invited",
        details,
      },
    });
  });

  it("answers 429 with Retry-After when the write limit is reached", async () => {
    rateLimited();

    const res = await send(valid);

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(service.createSpeaker).not.toHaveBeenCalled();
    expect(assertRateLimit).toHaveBeenCalledWith(
      "user-write",
      users.organizer.id,
    );
  });
});
