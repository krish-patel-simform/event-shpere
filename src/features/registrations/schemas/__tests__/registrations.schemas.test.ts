import {
  myRegistrationListQuerySchema,
  registrationEventParam,
  registrationResponseSchema,
} from "../registrations.schemas";

const eventId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";

describe("registrationEventParam", () => {
  it("accepts a uuid", () => {
    expect(registrationEventParam.safeParse({ eventId }).success).toBe(true);
  });

  it("rejects anything that is not a uuid, so it never reaches Postgres", () => {
    expect(registrationEventParam.safeParse({ eventId: "123" }).success).toBe(
      false,
    );
    expect(registrationEventParam.safeParse({}).success).toBe(false);
  });
});

describe("registrationResponseSchema", () => {
  const valid = {
    id: "3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f",
    eventId,
    status: "registered",
    ticketCode: "ESEVT7K3Q9P",
    amount: 0,
    currency: "INR",
    reason: "free",
    registeredAt: "2026-11-02T10:00:00.000Z",
  };

  it("accepts a free ticket and a complimentary one", () => {
    expect(registrationResponseSchema.safeParse(valid).success).toBe(true);
    expect(
      registrationResponseSchema.safeParse({
        ...valid,
        reason: "complimentary_speaker",
      }).success,
    ).toBe(true);
  });

  it("rejects a negative or fractional amount, a bad currency and an unknown reason", () => {
    expect(
      registrationResponseSchema.safeParse({ ...valid, amount: -1 }).success,
    ).toBe(false);
    expect(
      registrationResponseSchema.safeParse({ ...valid, amount: 1.5 }).success,
    ).toBe(false);
    expect(
      registrationResponseSchema.safeParse({ ...valid, currency: "RS" })
        .success,
    ).toBe(false);
    expect(
      registrationResponseSchema.safeParse({ ...valid, reason: "paid" })
        .success,
    ).toBe(false);
  });
});

describe("myRegistrationListQuerySchema", () => {
  it("defaults to the first page of ten, every status, upcoming events", () => {
    expect(myRegistrationListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 10,
      status: "all",
      when: "upcoming",
    });
  });

  it("turns the query-string numbers into numbers", () => {
    expect(
      myRegistrationListQuerySchema.parse({ page: "2", pageSize: "25" }),
    ).toMatchObject({ page: 2, pageSize: 25 });
  });

  it("accepts every status and when filter", () => {
    for (const status of ["all", "registered", "cancelled"]) {
      expect(myRegistrationListQuerySchema.safeParse({ status }).success).toBe(
        true,
      );
    }
    for (const when of ["upcoming", "past", "all"]) {
      expect(myRegistrationListQuerySchema.safeParse({ when }).success).toBe(
        true,
      );
    }
  });

  it.each([
    ["page 0", { page: "0" }],
    ["a fractional page", { page: "1.5" }],
    ["page size 0", { pageSize: "0" }],
    ["page size over 50", { pageSize: "51" }],
    ["an unknown status", { status: "pending_payment" }],
    ["an unknown when", { when: "tomorrow" }],
  ])("rejects %s", (_name, query) => {
    expect(myRegistrationListQuerySchema.safeParse(query).success).toBe(false);
  });

  it("has no user field: unknown keys are dropped, so the user can only come from the login", () => {
    const parsed = myRegistrationListQuerySchema.parse({ userId: "x" });
    expect(parsed).not.toHaveProperty("userId");
  });
});
