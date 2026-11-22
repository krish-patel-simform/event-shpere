import { NextRequest } from "next/server";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { readAccessTokenCookie } from "@/src/core/auth/server/auth-cookies";
import {
  resolveCurrentUser,
  type CurrentUser,
} from "@/src/core/auth/server/auth-session";
import { assertRateLimit } from "@/src/core/http/rate-limit";

// Shared pieces for route tests. A route test checks the ROUTE's own decisions: who may call it
// (401 / 403), how it reads params, query and body (400), what it hands the service, and the
// status and envelope it answers. The service is faked; its rules have their own tests.
//
// Every route test file starts with these three mocks (jest only hoists `jest.mock` written in
// the test file itself), then imports from here:
//
//   jest.mock("@/src/core/auth/server/auth-cookies", () => ({
//     readAccessTokenCookie: jest.fn(),
//     readRefreshTokenCookie: jest.fn(),
//     clearAuthCookies: jest.fn(),
//     writeAuthCookies: jest.fn(),
//   }));
//   jest.mock("@/src/core/auth/server/auth-session", () => ({
//     ...jest.requireActual("@/src/core/auth/server/auth-session"),
//     resolveCurrentUser: jest.fn(),
//   }));
//   jest.mock("@/src/core/http/rate-limit", () => ({ assertRateLimit: jest.fn() }));
//
// The role permission lists mirror the role → permission matrix (docs/permissions.md). They are
// written out here on purpose: tests must not import the seed data.

const USER: readonly PermissionCode[] = [
  "PROFILE_VIEW",
  "PROFILE_MANAGE",
  "REGISTRATION_CREATE",
  "REGISTRATION_VIEW_OWN",
  "REGISTRATION_MANAGE_OWN",
  "PAYMENT_CHECKOUT",
  "PAYMENT_VIEW_OWN",
  "SCHEDULE_MANAGE",
  "SCHEDULE_EXPORT",
  "POLL_VIEW",
  "POLL_VOTE",
  "NOTIFICATION_VIEW",
  "NOTIFICATION_MANAGE",
];

const SPEAKER: readonly PermissionCode[] = [
  ...USER,
  "SPEAKER_MANAGE_OWN",
  "SESSION_MATERIAL_UPLOAD_ASSIGNED",
  "POLL_CREATE_ASSIGNED",
  "POLL_MANAGE_ASSIGNED",
];

const ORGANIZER: readonly PermissionCode[] = [
  "PROFILE_VIEW",
  "PROFILE_MANAGE",
  "ORGANIZER_PROFILE_MANAGE_OWN",
  "EVENT_CREATE",
  "EVENT_MANAGE_OWN",
  "EVENT_PUBLISH_OWN",
  "REGISTRATION_VIEW_EVENT",
  "REGISTRATION_CHECKIN_EVENT",
  "PAYMENT_VIEW_EVENT",
  "PAYMENT_REFUND_EVENT",
  "SPEAKER_CREATE",
  "SPEAKER_MANAGE_EVENT",
  "SESSION_CREATE",
  "SESSION_MANAGE",
  "SESSION_MATERIAL_UPLOAD_EVENT",
  "POLL_VIEW",
  "POLL_CREATE_EVENT",
  "POLL_MANAGE_EVENT",
  "NOTIFICATION_VIEW",
  "NOTIFICATION_MANAGE",
  "NOTIFICATION_SEND_EVENT",
  "ANALYTICS_VIEW_EVENT",
];

const ADMIN: readonly PermissionCode[] = [
  "PROFILE_VIEW",
  "PROFILE_MANAGE",
  "EVENT_MANAGE_ALL",
  "EVENT_PUBLISH_ALL",
  "REGISTRATION_VIEW_ALL",
  "REGISTRATION_CHECKIN_ALL",
  "PAYMENT_VIEW_ALL",
  "PAYMENT_REFUND_ALL",
  "SPEAKER_CREATE",
  "SPEAKER_MANAGE_ALL",
  "SESSION_CREATE",
  "SESSION_MANAGE",
  "SESSION_MATERIAL_UPLOAD_ALL",
  "POLL_VIEW",
  "POLL_CREATE_ALL",
  "POLL_MANAGE_ALL",
  "NOTIFICATION_VIEW",
  "NOTIFICATION_MANAGE",
  "NOTIFICATION_SEND_ALL",
  "ANALYTICS_VIEW_ALL",
  "USER_VIEW",
  "USER_ROLE_MANAGE",
  "USER_STATUS_MANAGE",
  "ORGANIZER_CREATE",
  "ORGANIZER_VERIFY",
  "ORGANIZER_MANAGE",
  "MODERATION_MANAGE",
  "VENUE_MANAGE",
  "HALL_MANAGE",
];

function makeUser(
  role: CurrentUser["role"],
  id: string,
  permissions: readonly string[],
): CurrentUser {
  return {
    id,
    sessionId: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
    role,
    permissions: new Set(permissions),
    firstName: "Test",
    lastName: role,
    email: `${role}@example.com`,
  };
}

/** Signed-in callers with each role's real permissions. */
export const users = {
  user: makeUser("user", "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", USER),
  speaker: makeUser("speaker", "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", SPEAKER),
  organizer: makeUser(
    "organizer",
    "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
    ORGANIZER,
  ),
  admin: makeUser("admin", "4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f8a", ADMIN),
} as const;

/** A user with exactly these permissions (to prove a route needs one). */
export function userWith(permissions: readonly string[]): CurrentUser {
  return makeUser("user", "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c", permissions);
}

/** The next requests come from this signed-in user (or from a guest with `null`). */
export function signInAs(user: CurrentUser | null): void {
  jest
    .mocked(readAccessTokenCookie)
    .mockResolvedValue(user ? "access-jwt" : undefined);
  jest.mocked(resolveCurrentUser).mockResolvedValue(user);
}

/** The rate limit refuses the next request (429), to prove the route asks for it. */
export function rateLimited(): void {
  jest
    .mocked(assertRateLimit)
    .mockRejectedValueOnce(
      new (jest.requireActual("@/src/core/http/errors").RateLimitError)(
        "Too many requests, try again later",
        30,
      ),
    );
}

type CallOptions<P> = {
  params?: P;
  /** "?page=2&search=x" or an object. */
  query?: string | Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as is (for a multipart upload). */
  formData?: FormData;
  headers?: Record<string, string>;
};

type Handler<P> = (
  req: NextRequest,
  ctx: { params: Promise<P> },
) => Promise<Response>;

/** Calls a route handler the way Next.js does, with a request built from `options`. */
export function call<P>(
  handler: Handler<P>,
  method: string,
  path: string,
  options: CallOptions<P> = {},
): Promise<Response> {
  const search =
    options.query === undefined
      ? ""
      : typeof options.query === "string"
        ? options.query
        : `?${new URLSearchParams(options.query).toString()}`;
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers: { ...options.headers },
  };
  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    (init.headers as Record<string, string>)["content-type"] =
      "application/json";
  }
  return handler(new NextRequest(`http://localhost${path}${search}`, init), {
    params: Promise.resolve((options.params ?? {}) as P),
  });
}

/** The response body as JSON (a route always answers `{ data }` or `{ error }`). */
export async function body<T = { data?: unknown; error?: { code: string } }>(
  res: Response,
): Promise<T> {
  return (await res.json()) as T;
}

/** Resets every mock and quiets the route wrapper's error log for an expected 500. */
export function resetRouteMocks(): void {
  jest.resetAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
}
