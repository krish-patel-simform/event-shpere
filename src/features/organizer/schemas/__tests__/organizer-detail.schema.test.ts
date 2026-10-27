import {
  getOrganizerParamsSchema,
  organizerDetailResponseSchema,
} from "../organizer.schemas";

const id = "6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e15";

const detail = {
  id,
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

describe("getOrganizerParamsSchema", () => {
  it("takes an organizer id", () => {
    expect(getOrganizerParamsSchema.parse({ organizerId: id })).toEqual({
      organizerId: id,
    });
  });

  it.each(["", "abc", "1; drop table users", "../etc/passwd"])(
    "rejects %s, which is not an id",
    (organizerId) => {
      expect(getOrganizerParamsSchema.safeParse({ organizerId }).success).toBe(
        false,
      );
    },
  );
});

describe("organizerDetailResponseSchema", () => {
  it("accepts a waiting application", () => {
    expect(organizerDetailResponseSchema.safeParse(detail).success).toBe(true);
  });

  it("accepts a rejected one, an applicant with no role, and no website", () => {
    const result = organizerDetailResponseSchema.safeParse({
      ...detail,
      status: "rejected",
      rejectedAt: "2026-10-21T08:30:00.000Z",
      rejectionReason: "Duplicate application",
      organizationWebsite: null,
      applicant: { ...detail.applicant, role: null, emailVerifiedAt: null },
    });

    expect(result.success).toBe(true);
  });

  it("drops a field it does not list, so a sensitive column added to the query never leaves", () => {
    const parsed = organizerDetailResponseSchema.parse({
      ...detail,
      applicant: { ...detail.applicant, passwordHash: "secret" },
    });

    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it.each([
    ["status", "approved"],
    ["appliedAt", "yesterday"],
    ["hasDuplicate", "no"],
  ])("rejects a bad %s", (key, value) => {
    expect(
      organizerDetailResponseSchema.safeParse({ ...detail, [key]: value })
        .success,
    ).toBe(false);
  });
});
