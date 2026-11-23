import {
  cancelledRegistration,
  heldRegistration,
} from "../../__fixtures__/registration-service";
import { heldTicketPrice, toRegistrationDto } from "../registration.dto";

// Empty factory: the fixtures load the service, which must not load the DB client.
jest.mock("../registration.repository", () => ({}));

describe("heldTicketPrice", () => {
  it("is free on a free event", () => {
    expect(heldTicketPrice({ ticketPrice: 0, currency: "INR" })).toEqual({
      amount: 0,
      currency: "INR",
      reason: "free",
    });
  });

  it("is complimentary on a paid event: nobody has paid yet, so a held ticket was a gift", () => {
    expect(heldTicketPrice({ ticketPrice: 150_000, currency: "INR" })).toEqual({
      amount: 0,
      currency: "INR",
      reason: "complimentary_speaker",
    });
  });

  it("keeps the event's currency", () => {
    expect(heldTicketPrice({ ticketPrice: 0, currency: "USD" }).currency).toBe(
      "USD",
    );
  });
});

describe("toRegistrationDto", () => {
  const price = { amount: 0, currency: "INR", reason: "free" } as const;

  it("copies the ticket field by field with the date as an ISO string", () => {
    expect(toRegistrationDto(heldRegistration, price)).toEqual({
      id: heldRegistration.id,
      eventId: heldRegistration.eventId,
      status: "registered",
      ticketCode: heldRegistration.ticketCode,
      amount: 0,
      currency: "INR",
      reason: "free",
      registeredAt: "2026-11-01T08:00:00.000Z",
    });
  });

  it("never carries the user, the cancellation time or the update time", () => {
    const dto = toRegistrationDto(cancelledRegistration, price);

    expect(dto.status).toBe("cancelled");
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("cancelledAt");
    expect(dto).not.toHaveProperty("updatedAt");
  });
});
