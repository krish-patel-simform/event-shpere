import type { CurrentUser } from "@/src/core/auth/server/auth-session";
import { ConflictError, NotFoundError } from "@/src/core/http";
import { assertRateLimit } from "@/src/core/http/rate-limit";
import {
  body,
  call,
  rateLimited,
  resetRouteMocks,
  signInAs,
  type Handler,
} from "./route-test";

// The cases every "resend the set-password invite" route has in common (organizers, users and
// speakers): the same answer, the same guards, the same pass-through of the service's errors. Each
// route test file keeps its own `jest.mock` of its service (jest only hoists a mock written in the
// test file itself) and passes in what differs: the route, the id, who calls, what the service is
// called with. A rule only one route has goes in `extra`, which runs inside the same describe, so
// it gets the same sign-in and mocks.

const INVITE = {
  setupEmailQueued: true,
  expiresAt: "2026-11-25T09:00:00.000Z",
};

/** Sends the request the way the tests of one route do; `headers` is for the cross-site test. */
export type SendInvite = (
  headers?: Record<string, string>,
) => Promise<Response>;

export type ResendInviteRouteCase<P> = {
  /** The describe title, e.g. "POST /api/admin/users/[userId]/resend-invite". */
  name: string;
  handler: Handler<P>;
  /** The URL and route params of a valid request. */
  path: string;
  params: P;
  /** A request whose id is not valid for this route: `label` finishes "refuses ... (400)". */
  invalid: { label: string; path: string; params: P };
  /** The service's `resendInvite`, already replaced by a jest.fn in the test file. */
  resendInvite: jest.Mock;
  /** Signed in as this user unless a test says otherwise. */
  caller: CurrentUser;
  /** What the service must be called with for a request from `caller`. */
  calledWith: (caller: CurrentUser) => unknown[];
  /** Someone the route must refuse with a 403: `label` finishes "refuses ... (403)". */
  forbidden: { label: string; user: CurrentUser };
  /** The message of the service's 404 (it names the thing that was not found). */
  notFoundMessage: string;
  /** Rules only this route has. */
  extra?: (helpers: { send: SendInvite }) => void;
};

export function describeResendInviteRoute<P>(
  options: ResendInviteRouteCase<P>,
) {
  const { resendInvite, caller } = options;
  const send: SendInvite = (headers) =>
    call(options.handler, "POST", options.path, {
      params: options.params,
      headers,
    });

  describe(options.name, () => {
    beforeEach(() => {
      resetRouteMocks();
      signInAs(caller);
      resendInvite.mockResolvedValue(INVITE);
    });
    afterEach(() => jest.restoreAllMocks());

    it("re-sends the invite: 200 with when the new link expires", async () => {
      const res = await send();

      expect(res.status).toBe(200);
      expect(await body(res)).toEqual({ data: INVITE });
      expect(resendInvite).toHaveBeenCalledWith(...options.calledWith(caller));
    });

    it("never answers the setup link, even if the service returns one", async () => {
      resendInvite.mockResolvedValue({
        ...INVITE,
        token: "secret-setup-token",
      });

      const res = await send();

      expect(res.status).toBe(200);
      expect(JSON.stringify(await body(res))).not.toContain(
        "secret-setup-token",
      );
    });

    it(`refuses ${options.invalid.label} (400)`, async () => {
      const res = await call(options.handler, "POST", options.invalid.path, {
        params: options.invalid.params,
      });

      expect(res.status).toBe(400);
      expect((await body(res)).error?.code).toBe("VALIDATION_ERROR");
      expect(resendInvite).not.toHaveBeenCalled();
    });

    it("refuses a guest (401)", async () => {
      signInAs(null);

      const res = await send();

      expect(res.status).toBe(401);
      expect(resendInvite).not.toHaveBeenCalled();
    });

    it(`refuses ${options.forbidden.label} (403)`, async () => {
      signInAs(options.forbidden.user);

      const res = await send();

      expect(res.status).toBe(403);
      expect(resendInvite).not.toHaveBeenCalled();
    });

    it("blocks a request from another site (403) before sending anything", async () => {
      const res = await send({ origin: "https://evil.example" });

      expect(res.status).toBe(403);
      expect(resendInvite).not.toHaveBeenCalled();
    });

    it("passes on the service's 404 for an unknown account", async () => {
      resendInvite.mockRejectedValue(
        new NotFoundError(options.notFoundMessage),
      );

      const res = await send();

      expect(res.status).toBe(404);
    });

    it("passes on a 409 with its code when the account is already set up", async () => {
      resendInvite.mockRejectedValue(
        new ConflictError(
          "ACCOUNT_ALREADY_ACTIVE",
          "This person has already set up their account.",
        ),
      );

      const res = await send();

      expect(res.status).toBe(409);
      expect(await body(res)).toEqual({
        error: {
          code: "ACCOUNT_ALREADY_ACTIVE",
          message: "This person has already set up their account.",
        },
      });
    });

    it("answers 429 with Retry-After when the write limit is reached", async () => {
      rateLimited();

      const res = await send();

      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("30");
      expect(resendInvite).not.toHaveBeenCalled();
      expect(assertRateLimit).toHaveBeenCalledWith("user-write", caller.id);
    });

    options.extra?.({ send });
  });
}
