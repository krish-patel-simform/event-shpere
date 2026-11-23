import { organizerService } from "@/src/features/organizer/server";
import { describeResendInviteRoute } from "../../../../../__fixtures__/resend-invite-route-test";
import { userWith, users } from "../../../../../__fixtures__/route-test";
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The invite rules (only pending accounts, 60 s cooldown) have their own tests.
jest.mock("@/src/features/organizer/server", () => ({
  organizerService: { resendInvite: jest.fn() },
}));
const service = jest.mocked(organizerService);

const ORGANIZER_ID = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e13";

// The shared cases (answer, guards, error pass-through) live in the factory.
describeResendInviteRoute({
  name: "POST /api/admin/organizers/[organizerId]/resend-invite",
  handler: POST,
  path: `/api/admin/organizers/${ORGANIZER_ID}/resend-invite`,
  params: { organizerId: ORGANIZER_ID },
  invalid: {
    label: "an organizer id that is not a uuid",
    path: "/api/admin/organizers/nope/resend-invite",
    params: { organizerId: "nope" },
  },
  resendInvite: service.resendInvite,
  caller: users.admin,
  calledWith: () => [ORGANIZER_ID],
  forbidden: {
    label: "a caller without ORGANIZER_CREATE",
    user: userWith(["ORGANIZER_MANAGE", "ORGANIZER_VERIFY"]),
  },
  notFoundMessage: "Organizer not found",
});
