/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FUTURES_ID,
  findSampleOverview,
  MEETUP_ID,
  SUMMIT_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventCheckInHref, eventSessionsHref } from "../../../events";
import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import { eventSessionEditHref } from "../../routes";
import type { SessionDto } from "../../schemas/sessions.schemas";
import { EventSessionDetail } from "../EventSessionDetail";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { get: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { get: jest.fn() },
}));
// The list (route 10) has its own tests in the registrations feature: here it only has to receive
// the right session and hall capacity, so it is a stub that shows what it was given.
jest.mock("@/src/features/registrations", () => ({
  SessionAttendeeList: ({
    session,
  }: {
    session: {
      eventId: string;
      sessionId: string;
      timezone: string;
      hallCapacity: number | null | undefined;
      door: { status: string; eventStatus: string; place: string | null };
      eventDoorHref: string;
    };
  }) => (
    <>
      <p>
        Seat list: {session.eventId} · {session.sessionId} · {session.timezone}{" "}
        · capacity {String(session.hallCapacity)}
      </p>
      <p>
        Door: {session.door.status} · event {session.door.eventStatus} ·{" "}
        {session.door.place} · {session.eventDoorHref}
      </p>
    </>
  ),
}));

// Who is looking: the organizer by default (EVENT_MANAGE_OWN); a test can be an admin.
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const hasPermission = jest.mocked(useHasPermission);
const events = jest.mocked(eventApiService);
const api = jest.mocked(sessionApiService);
const venues = jest.mocked(venueApiService);

/** A session that needs booking, in Hall A of the Summit's venue. */
const bookable: SessionDto = {
  ...talk,
  requiresRegistration: true,
  hallId: HALL_A_ID,
};

function show(session: SessionDto, eventId = SUMMIT_ID) {
  const overview = findSampleOverview(eventId);
  if (!overview) throw new Error("no sample overview");
  events.getOverview.mockResolvedValue(overview);
  api.get.mockResolvedValue({ ...session, eventId });
  renderWithClient(
    <EventSessionDetail eventId={eventId} sessionId={session.id} />,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(true);
  venues.get.mockResolvedValue({
    halls: [
      {
        id: HALL_A_ID,
        name: "Hall A",
        capacity: 300,
        sortOrder: 0,
        isActive: true,
      },
      {
        id: HALL_B_ID,
        name: "Hall B",
        capacity: 40,
        sortOrder: 1,
        isActive: true,
      },
    ],
  } as never);
});

describe("EventSessionDetail", () => {
  it("keeps the event's header with the Sessions tab current, and a way back to all sessions", async () => {
    show(bookable);
    await screen.findByRole("heading", { level: 1 });

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All sessions" })).toHaveAttribute(
      "href",
      eventSessionsHref(SUMMIT_ID),
    );
  });

  it("shows the session's facts: type, format, status, slot in the event's zone, place and speakers", async () => {
    show(bookable);

    expect(await screen.findByText(talk.title)).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText(/10:00 – 11:00 IST · Hall A/)).toBeInTheDocument();
  });

  it("offers Edit session (to the edit form) while the session can change", async () => {
    show(bookable);

    expect(
      await screen.findByRole("link", { name: "Edit session" }),
    ).toHaveAttribute("href", eventSessionEditHref(SUMMIT_ID, talk.id));
  });

  it("offers no Edit session to an admin (view only), but still shows the page", async () => {
    hasPermission.mockImplementation((code) => code !== "EVENT_MANAGE_OWN");
    show(bookable);

    expect(await screen.findByText(bookable.title)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit session" })).toBeNull();
  });

  it.each([
    ["a cancelled session", cancelledKeynote, SUMMIT_ID],
    ["a session of a cancelled event", bookable, MEETUP_ID],
    ["a session of an event that has ended", bookable, FUTURES_ID],
  ])(
    "offers no Edit session for %s, but still shows the page",
    async (_name, session, eventId) => {
      show(session, eventId);

      expect(await screen.findByText(session.title)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Edit session" })).toBeNull();
    },
  );

  it("says a cancelled session was cancelled", async () => {
    show(cancelledKeynote);

    expect(
      await screen.findByText(/This session was cancelled/),
    ).toBeInTheDocument();
  });

  it("hands the seat list the session and its hall's capacity from the venue", async () => {
    show(bookable);

    expect(
      await screen.findByText(
        `Seat list: ${SUMMIT_ID} · ${talk.id} · Asia/Kolkata · capacity 300`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Who booked a seat" }),
    ).toBeInTheDocument();
  });

  it("hands the check-in door the session's status, the event's status, the hall and the event door's page", async () => {
    show(bookable);

    expect(
      await screen.findByText(
        `Door: scheduled · event published · Hall A · ${eventCheckInHref(SUMMIT_ID)}`,
      ),
    ).toBeInTheDocument();
  });

  it("tells the door a cancelled event is cancelled", async () => {
    show(bookable, MEETUP_ID);

    expect(await screen.findByText(/event cancelled/)).toBeInTheDocument();
  });

  it("has no seat limit for a session without a hall (online), and does not ask for the venue", async () => {
    show({ ...workshop, mode: "online", hallId: null, hallName: null });

    expect(await screen.findByText(/capacity null/)).toBeInTheDocument();
    expect(venues.get).not.toHaveBeenCalled();
  });

  it("says no booking is needed, with no seat list, for a session that needs none", async () => {
    show(talk);

    expect(
      await screen.findByText("No booking needed for this session"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Seat list:/)).toBeNull();
  });

  it("says the session was not found (404), with a way back and no retry", async () => {
    const overview = findSampleOverview(SUMMIT_ID);
    events.getOverview.mockResolvedValue(overview!);
    api.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Not found"));
    renderWithClient(
      <EventSessionDetail eventId={SUMMIT_ID} sessionId={talk.id} />,
    );

    expect(await screen.findByText("Session not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to sessions" }),
    ).toHaveAttribute("href", eventSessionsHref(SUMMIT_ID));
  });

  it("offers Try again for another failure", async () => {
    const user = userEvent.setup();
    const overview = findSampleOverview(SUMMIT_ID);
    events.getOverview.mockResolvedValue(overview!);
    api.get.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "Busy"));
    renderWithClient(
      <EventSessionDetail eventId={SUMMIT_ID} sessionId={talk.id} />,
    );

    await screen.findByText(
      "We couldn't load this session",
      {},
      { timeout: 5000 },
    );
    api.get.mockResolvedValue(bookable);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(talk.title)).toBeInTheDocument();
  });
});
