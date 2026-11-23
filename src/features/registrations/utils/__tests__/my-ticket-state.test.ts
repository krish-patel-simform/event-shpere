import { ApiError } from "../../../../core/api-client/base-api.service";
import type { MyTicketDto } from "../../schemas/registrations.schemas";
import {
  bookedSessionsLabel,
  myTicketState,
  relativeEventDay,
  ticketCancelFailure,
} from "../my-ticket-state";

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";

// Registration closes 2 Dec 18:00 IST; the event runs 3 Dec 09:00 – 5 Dec 18:00 IST.
const ticket = (
  overrides: {
    registration?: Partial<MyTicketDto["registration"]>;
    event?: Partial<MyTicketDto["event"]>;
    bookedSessionCount?: number;
  } = {},
): MyTicketDto => ({
  registration: {
    id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
    eventId: EVENT_ID,
    status: "registered",
    ticketCode: "ESEVT7K3Q9P",
    amount: 0,
    currency: "INR",
    reason: "free",
    registeredAt: "2026-11-10T10:00:00.000Z",
    ...overrides.registration,
  },
  event: {
    id: EVENT_ID,
    slug: "summit",
    title: "Summit",
    status: "published",
    startAt: "2026-12-03T03:30:00.000Z",
    endAt: "2026-12-05T12:30:00.000Z",
    timezone: "Asia/Kolkata",
    registrationClosesAt: "2026-12-02T12:30:00.000Z",
    venueName: "Convention Centre",
    venueCity: "Pune",
    ...overrides.event,
  },
  bookedSessionCount: overrides.bookedSessionCount ?? 3,
});

const at = (iso: string) => new Date(iso);

describe("relativeEventDay (in the event's time zone)", () => {
  const event = ticket().event;

  it("counts whole calendar days to the first day", () => {
    // 20 Nov 15:30 IST → 3 Dec: 13 days.
    expect(relativeEventDay(event, at("2026-11-20T10:00:00.000Z"))).toBe(
      "In 13 days",
    );
  });

  it("says Tomorrow on the day before, even late at night", () => {
    // 2 Dec 23:59 IST.
    expect(relativeEventDay(event, at("2026-12-02T18:29:00.000Z"))).toBe(
      "Tomorrow",
    );
  });

  it("uses the event's day, not UTC's: just after midnight IST on 3 Dec is Today", () => {
    // 2 Dec 18:31 UTC is already 3 Dec 00:01 in India, before the 09:00 start.
    expect(relativeEventDay(event, at("2026-12-02T18:31:00.000Z"))).toBe(
      "Today",
    );
  });

  it("says Happening now from the start until the end", () => {
    expect(relativeEventDay(event, at("2026-12-03T03:30:00.000Z"))).toBe(
      "Happening now",
    );
    expect(relativeEventDay(event, at("2026-12-04T10:00:00.000Z"))).toBe(
      "Happening now",
    );
  });

  it("says Ended from the very end moment", () => {
    expect(relativeEventDay(event, at("2026-12-05T12:30:00.000Z"))).toBe(
      "Ended",
    );
  });
});

describe("myTicketState", () => {
  const NOW = at("2026-11-20T10:00:00.000Z");

  it("a live ticket can be cancelled until registration closes", () => {
    expect(myTicketState(ticket(), NOW)).toEqual({
      kind: "registered",
      when: "In 13 days",
      canCancel: true,
    });
  });

  it("can no longer be cancelled at the closing moment", () => {
    expect(
      myTicketState(ticket(), at("2026-12-02T12:30:00.000Z")),
    ).toMatchObject({ kind: "registered", canCancel: false });
  });

  it("without a closing time, can be cancelled until the event starts", () => {
    const noClose = ticket({ event: { registrationClosesAt: null } });
    expect(
      myTicketState(noClose, at("2026-12-03T03:29:00.000Z")),
    ).toMatchObject({ canCancel: true });
    expect(
      myTicketState(noClose, at("2026-12-03T03:30:00.000Z")),
    ).toMatchObject({ canCancel: false });
  });

  it("a ticket of a past event stays registered, not cancellable", () => {
    expect(myTicketState(ticket(), at("2026-12-10T00:00:00.000Z"))).toEqual({
      kind: "registered",
      when: "Ended",
      canCancel: false,
    });
  });

  it("a cancelled event says the organizer cancelled it, whatever the row says", () => {
    expect(
      myTicketState(
        ticket({
          event: { status: "cancelled" },
          registration: { status: "cancelled" },
        }),
        NOW,
      ),
    ).toEqual({ kind: "event_cancelled" });
    expect(
      myTicketState(ticket({ event: { status: "cancelled" } }), NOW),
    ).toEqual({ kind: "event_cancelled" });
  });

  it("a ticket the user cancelled can be registered again until the event ends", () => {
    const own = ticket({ registration: { status: "cancelled" } });
    expect(myTicketState(own, NOW)).toEqual({
      kind: "cancelled",
      canRegisterAgain: true,
    });
    expect(myTicketState(own, at("2026-12-05T12:30:00.000Z"))).toEqual({
      kind: "cancelled",
      canRegisterAgain: false,
    });
  });
});

describe("bookedSessionsLabel", () => {
  it.each([
    [0, "No sessions booked yet"],
    [1, "1 session booked"],
    [6, "6 sessions booked"],
  ])("%i → %s", (count, label) => {
    expect(bookedSessionsLabel(count)).toBe(label);
  });
});

describe("ticketCancelFailure", () => {
  it("is null without an error", () => {
    expect(ticketCancelFailure(null)).toBeNull();
  });

  it.each([
    [new ApiError(409, "CANCELLATION_CLOSED", ""), /has closed/],
    [new ApiError(409, "ALREADY_CHECKED_IN", ""), /checked in/],
    [new ApiError(404, "NOT_FOUND", ""), /no longer there/],
  ])("%s is final: trying again cannot work", (error, message) => {
    const failure = ticketCancelFailure(error);
    expect(failure?.final).toBe(true);
    expect(failure?.message).toMatch(message);
  });

  it.each([
    [new ApiError(429, "RATE_LIMITED", ""), /too often/],
    [new ApiError(0, "NETWORK_ERROR", ""), /reach the server/],
    [new ApiError(503, "SERVICE_UNAVAILABLE", ""), /busy/],
    [new ApiError(409, "REGISTRATION_CHANGED", ""), /changed/],
  ])("%s can be tried again", (error, message) => {
    const failure = ticketCancelFailure(error);
    expect(failure?.final).toBe(false);
    expect(failure?.message).toMatch(message);
  });
});
