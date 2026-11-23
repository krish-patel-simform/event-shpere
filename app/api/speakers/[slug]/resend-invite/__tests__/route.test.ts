import { PERMISSION } from "@/src/core/auth/permission-catalog";
import { ForbiddenError } from "@/src/core/http";
import { speakerService } from "@/src/features/speakers/server";
import { describeResendInviteRoute } from "../../../../__fixtures__/resend-invite-route-test";
import {
  body,
  signInAs,
  userWith,
  users,
} from "../../../../__fixtures__/route-test";
import { POST } from "../route";

// The cookie, session and rate limit mocks are in jest.route.setup.ts (loaded for every route test).
// The service's rules (pending only, cooldown, verified organizer) have their own tests: faked here.
jest.mock("@/src/features/speakers/server", () => ({
  speakerService: { resendInvite: jest.fn() },
}));
const service = jest.mocked(speakerService);

const SLUG = "sneha-desai-9d8c7b";

// The shared cases (answer, guards, error pass-through) live in the factory; below it, only what
// this route does differently: the service also gets the caller, and who may use it.
describeResendInviteRoute({
  name: "POST /api/speakers/[slug]/resend-invite",
  handler: POST,
  path: `/api/speakers/${SLUG}/resend-invite`,
  params: { slug: SLUG },
  invalid: {
    label: "a slug that is not one",
    path: "/api/speakers/Bad Slug/resend-invite",
    params: { slug: "Bad Slug" },
  },
  resendInvite: service.resendInvite,
  caller: users.organizer,
  // The service decides who may resend for whom, so it is handed the caller as well.
  calledWith: (caller) => [SLUG, caller],
  forbidden: { label: "a user without SPEAKER_CREATE", user: users.user },
  notFoundMessage: "Speaker not found",
  extra: ({ send }) => {
    it("lets an admin resend too", async () => {
      signInAs(users.admin);

      const res = await send();

      expect(res.status).toBe(200);
      expect(service.resendInvite).toHaveBeenCalledWith(SLUG, users.admin);
    });

    it("needs only SPEAKER_CREATE", async () => {
      signInAs(userWith([PERMISSION.SPEAKER_CREATE]));

      const res = await send();

      expect(res.status).toBe(200);
    });

    it("refuses a speaker without SPEAKER_CREATE (403)", async () => {
      signInAs(users.speaker);

      const res = await send();

      expect(res.status).toBe(403);
      expect(service.resendInvite).not.toHaveBeenCalled();
    });

    it("passes on the service's 403 for an organizer not approved yet", async () => {
      service.resendInvite.mockRejectedValue(new ForbiddenError());

      const res = await send();

      expect(res.status).toBe(403);
    });

    it("never answers a result that breaks the contract (500, no link leaked)", async () => {
      service.resendInvite.mockResolvedValue({
        setupEmailQueued: true,
        expiresAt: "tomorrow",
        token: "secret-setup-token",
      } as never);

      const res = await send();

      expect(res.status).toBe(500);
      expect(JSON.stringify(await body(res))).not.toContain(
        "secret-setup-token",
      );
    });
  },
});
