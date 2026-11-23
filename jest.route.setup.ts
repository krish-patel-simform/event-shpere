// The mocks every API route test starts with. Only the "routes" Jest project (see jest.config.ts:
// app/api/**/route.test.ts) loads this file, so no other test gets them.
//
// A route test checks the ROUTE's own decisions (who may call it, how it reads the request, what it
// answers), so the three things that would reach outside are faked: the cookie, the session lookup
// and the rate limiter (which would count every test against the real Redis). The helpers in
// app/api/__fixtures__/route-test.ts (signInAs, rateLimited...) drive these mocks.
//
// A test file that needs different mocks (logout, refresh...) writes its own `jest.mock` for the
// same module: that one replaces the shared one, because it runs later.

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
