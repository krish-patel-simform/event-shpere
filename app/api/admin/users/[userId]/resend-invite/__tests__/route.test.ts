import { RateLimitError } from "@/src/core/http";
import { userService } from "@/src/features/users/server";
import { describeResendInviteRoute } from "../../../../../__fixtures__/resend-invite-route-test";
import { body, userWith, users } from "../../../../../__fixtures__/route-test";
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The invite rules (only pending accounts, 60 s cooldown) have their own tests.
jest.mock("@/src/features/users/server", () => ({
  userService: { resendInvite: jest.fn() },
}));
const service = jest.mocked(userService);

const USER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e48";

// The shared cases (answer, guards, error pass-through) live in the factory.
describeResendInviteRoute({
  name: "POST /api/admin/users/[userId]/resend-invite",
  handler: POST,
  path: `/api/admin/users/${USER_ID}/resend-invite`,
  params: { userId: USER_ID },
  invalid: {
    label: "a user id that is not a uuid",
    path: "/api/admin/users/nope/resend-invite",
    params: { userId: "nope" },
  },
  resendInvite: service.resendInvite,
  caller: users.admin,
  calledWith: () => [USER_ID],
  forbidden: {
    label: "a caller with only USER_VIEW",
    user: userWith(["USER_VIEW"]),
  },
  notFoundMessage: "User not found",
  extra: ({ send }) => {
    it("passes on the service's 429 cooldown (an invite was sent moments ago)", async () => {
      service.resendInvite.mockRejectedValue(
        new RateLimitError(
          "An invite was sent moments ago. Try again in 42 seconds.",
        ),
      );

      const res = await send();

      expect(res.status).toBe(429);
      expect((await body(res)).error?.code).toBe("RATE_LIMITED");
    });
  },
});
