import type { OrganizerDetailDto } from "../../schemas/organizer.schemas";
import {
  buildChecks,
  buildHistory,
  canApprove,
  COMMON_REJECTION_REASONS,
} from "../organizer-review";

/** A clean waiting application, as GET /api/admin/organizers/[id] returns it. */
const review: OrganizerDetailDto = {
  id: "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15",
  organizationName: "Acme Events Pvt Ltd",
  organizationWebsite: "https://acme-events.example.com",
  appliedAt: "2026-10-20T09:18:00.000Z",
  status: "pending",
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  hasDuplicate: false,
  applicant: {
    userId: "8f2c41a0-6b1e-4c52-9a3d-7e5b1c0d2f34",
    firstName: "Ananya",
    lastName: "Rao",
    email: "ananya.rao@example.com",
    emailVerifiedAt: "2026-10-20T09:21:00.000Z",
    accountStatus: "active",
    role: "user",
    createdAt: "2026-10-20T09:18:00.000Z",
  },
};

/** The application with some fields changed. */
function changed(
  overrides: Partial<Omit<OrganizerDetailDto, "applicant">> & {
    applicant?: Partial<OrganizerDetailDto["applicant"]>;
  },
): OrganizerDetailDto {
  return {
    ...review,
    ...overrides,
    applicant: { ...review.applicant, ...overrides.applicant },
  };
}

const byKey = (checks: ReturnType<typeof buildChecks>, key: string) =>
  checks.find((check) => check.key === key);

describe("buildChecks", () => {
  it("passes the email, the account and the duplicate check for a clean application, and leaves the website to the admin", () => {
    const checks = buildChecks(review);

    expect(checks.map((check) => [check.key, check.state])).toEqual([
      ["email", "pass"],
      ["account", "pass"],
      ["duplicate", "pass"],
      ["website", "manual"],
    ]);
    expect(byKey(checks, "email")?.detail).toContain("ananya.rao@example.com");
  });

  it("fails the email check when the applicant has not confirmed their email", () => {
    const check = byKey(
      buildChecks(changed({ applicant: { emailVerifiedAt: null } })),
      "email",
    );

    expect(check?.state).toBe("fail");
    expect(check?.title).toBe("Email address not verified");
  });

  it.each([
    ["suspended", "The account is suspended."],
    ["pending", "The account has not been set up yet."],
  ] as const)(
    "fails the account check for a %s account and says why",
    (accountStatus, why) => {
      const check = byKey(
        buildChecks(changed({ applicant: { accountStatus } })),
        "account",
      );

      expect(check?.state).toBe("fail");
      expect(check?.detail).toBe(why);
    },
  );

  it("fails the duplicate check when another organizer uses the name or website", () => {
    const check = byKey(
      buildChecks(changed({ hasDuplicate: true })),
      "duplicate",
    );

    expect(check?.state).toBe("fail");
    expect(check?.title).toBe("Possible duplicate organisation");
  });

  it("says so when there is no website to check", () => {
    const check = byKey(
      buildChecks(changed({ organizationWebsite: null })),
      "website",
    );

    expect(check?.state).toBe("manual");
    expect(check?.title).toBe("No website given");
  });
});

describe("canApprove", () => {
  it("needs a waiting application whose applicant verified their email", () => {
    expect(canApprove(review)).toBe(true);
    expect(canApprove(changed({ applicant: { emailVerifiedAt: null } }))).toBe(
      false,
    );
  });

  it.each(["verified", "rejected"] as const)(
    "is not offered for an application that is already %s",
    (status) => {
      expect(canApprove(changed({ status }))).toBe(false);
    },
  );
});

describe("buildHistory", () => {
  it("for a waiting application: the wait, the email, the submission, newest first", () => {
    const items = buildHistory(review);

    expect(items.map((item) => item.title)).toEqual([
      "Waiting for admin decision",
      "Email verified",
      "Application submitted",
    ]);
    // The wait is a step still to come: an empty dot. The others happened.
    expect(items.map((item) => Boolean(item.done))).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("leaves out 'Email verified' when it never happened", () => {
    const items = buildHistory(
      changed({ applicant: { emailVerifiedAt: null } }),
    );

    expect(items.map((item) => item.title)).toEqual([
      "Waiting for admin decision",
      "Application submitted",
    ]);
  });

  it("starts with the approval, and its date, once approved", () => {
    const [first] = buildHistory(
      changed({ status: "verified", approvedAt: "2026-10-26T12:00:00.000Z" }),
    );

    expect(first).toMatchObject({ title: "Approved", done: true });
    expect(first.detail).toBe("26 October 2026, 12:00");
  });

  it("starts with the rejection, its date and the reason the applicant was given", () => {
    const [first] = buildHistory(
      changed({
        status: "rejected",
        rejectedAt: "2026-10-26T12:00:00.000Z",
        rejectionReason: "Duplicate application",
      }),
    );

    expect(first).toMatchObject({ title: "Rejected", done: true });
    expect(first.detail).toBe("26 October 2026, 12:00 · Duplicate application");
  });
});

describe("COMMON_REJECTION_REASONS", () => {
  it("each one has a label for the list and the words that go in the box", () => {
    for (const reason of COMMON_REJECTION_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.text.length).toBeGreaterThan(20);
    }
    expect(new Set(COMMON_REJECTION_REASONS.map((r) => r.value)).size).toBe(
      COMMON_REJECTION_REASONS.length,
    );
  });
});
