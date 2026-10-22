import { cookies } from "next/headers";
import { clearAuthCookies, writeAuthCookies } from "../auth-cookies";
import type { AuthTokens } from "../auth-session";

// The cookie store is faked, so the test reads back exactly what the helpers asked to set.
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
const mockSet = jest.fn();
beforeEach(() => {
  mockSet.mockReset();
  jest.mocked(cookies).mockResolvedValue({ set: mockSet } as never);
});

/** Every `set` call for one cookie name, as { value, path, ... } for easy matching. */
function setCalls(name: string) {
  return mockSet.mock.calls
    .filter(([cookieName]) => cookieName === name)
    .map(([, value, options]) => ({ value, ...options }));
}

const tokens: AuthTokens = {
  accessToken: {
    token: "access-jwt",
    expiresAt: new Date("2026-10-21T10:15:00Z"),
  },
  refreshToken: {
    token: "refresh-jwt",
    expiresAt: new Date("2026-10-28T10:00:00Z"),
  },
};

describe("writeAuthCookies", () => {
  it("sets the access token on every route and the refresh token only on /api/auth", async () => {
    await writeAuthCookies(tokens);

    expect(setCalls("es_access_token")).toEqual([
      expect.objectContaining({ value: "access-jwt", path: "/" }),
    ]);
    expect(setCalls("es_refresh_token")).toEqual([
      expect.objectContaining({ value: "refresh-jwt", path: "/api/auth" }),
    ]);
  });

  it("makes both cookies httpOnly and lax, each expiring with its token", async () => {
    await writeAuthCookies(tokens);

    const [access] = setCalls("es_access_token");
    const [refresh] = setCalls("es_refresh_token");
    for (const cookie of [access, refresh]) {
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax" });
    }
    expect(access.expires).toEqual(tokens.accessToken.expiresAt);
    expect(refresh.expires).toEqual(tokens.refreshToken.expiresAt);
  });
});

describe("clearAuthCookies", () => {
  it("empties the access cookie on its own path", async () => {
    await clearAuthCookies();

    expect(setCalls("es_access_token")).toEqual([
      expect.objectContaining({ value: "", path: "/", maxAge: 0 }),
    ]);
  });

  it("empties the refresh cookie on the path it is set on, and on the old '/' path", async () => {
    await clearAuthCookies();

    // A cookie is only removed when the path matches the one it was set with.
    const paths = setCalls("es_refresh_token").map((cookie) => cookie.path);
    expect(paths).toEqual(["/api/auth", "/"]);
    for (const cookie of setCalls("es_refresh_token")) {
      expect(cookie).toMatchObject({ value: "", maxAge: 0 });
    }
  });
});
