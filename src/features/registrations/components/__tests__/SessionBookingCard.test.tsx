/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { formatZonedDateTime } from "@/src/core/format/format-zoned";
import {
  AUTH_ROUTES,
  PermissionProvider,
  type MeDto,
} from "@/src/features/auth";
import { authApiService } from "@/src/features/auth/api/auth-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type {
  MyRegistrationDto,
  RegistrationDto,
  SessionBookingDto,
} from "../../schemas/registrations.schemas";
import type {
  SessionBookingEvent,
  SessionBookingTarget,
} from "../../utils/session-booking-state";
import { EventRegistrationCard } from "../EventRegistrationCard";
import { SessionBookingCard } from "../SessionBookingCard";

jest.mock("@/src/features/auth/api/auth-api.service", () => ({
  authApiService: { getMe: jest.fn() },
}));
jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    register: jest.fn(),
    getMine: jest.fn(),
    cancel: jest.fn(),
    bookSession: jest.fn(),
    cancelSessionBooking: jest.fn(),
  },
}));
const getMe = jest.mocked(authApiService.getMe);
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const SESSION_ID = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

/** Registration closes in 10 days; the event starts in 11; this session is in 12 days. */
const event = (
  overrides: Partial<SessionBookingEvent> = {},
): SessionBookingEvent => ({
  id: EVENT_ID,
  status: "published",
  startAt: fromNow(11),
  registrationClosesAt: fromNow(10),
  timezone: "Asia/Kolkata",
  ...overrides,
});

const session = (
  overrides: Partial<SessionBookingTarget> = {},
): SessionBookingTarget => ({
  id: SESSION_ID,
  startAt: fromNow(12),
  mode: "in_person",
  hallName: "Hall B",
  requiresRegistration: true,
  price: 0,
  seatsLeft: 32,
  ...overrides,
});

const ticket: RegistrationDto = {
  id: "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e",
  eventId: EVENT_ID,
  status: "registered",
  ticketCode: "ESEVT7K3Q9P",
  amount: 0,
  currency: "INR",
  reason: "free",
  registeredAt: fromNow(-2),
};

const REGISTERED: MyRegistrationDto = {
  registration: ticket,
  bookedSessionIds: [],
};
const BOOKED: MyRegistrationDto = {
  registration: ticket,
  bookedSessionIds: [SESSION_ID],
};

const booking = (status: "registered" | "cancelled"): SessionBookingDto => ({
  id: "7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a",
  sessionId: SESSION_ID,
  status,
  registeredAt: fromNow(-1),
});

const ATTENDEE: PermissionCode[] = [
  "REGISTRATION_CREATE",
  "REGISTRATION_VIEW_OWN",
  "REGISTRATION_MANAGE_OWN",
];
const account = (
  role: MeDto["role"],
  permissions: PermissionCode[],
): MeDto => ({
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Rahul",
  lastName: "Sharma",
  email: "rahul@example.com",
  role,
  permissions,
});

function Providers({ children }: { children: ReactNode }) {
  // One client for the life of the test render (a new one per render would drop the cache).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <PermissionProvider>{children}</PermissionProvider>
    </QueryClientProvider>
  );
}

const bookingCard = (
  sessionOverrides: Partial<SessionBookingTarget> = {},
  eventOverrides: Partial<SessionBookingEvent> = {},
) => (
  <SessionBookingCard
    session={session(sessionOverrides)}
    sessionTitle="Scaling Next.js Applications"
    event={event(eventOverrides)}
    eventHref="/events/summit"
    mySessionsHref="/speaker/sessions"
    when="Fri 4 Dec 2026 · 10:00 – 10:45 IST · Hall B"
  />
);

function renderCard(
  sessionOverrides: Partial<SessionBookingTarget> = {},
  eventOverrides: Partial<SessionBookingEvent> = {},
) {
  return render(
    <Providers>{bookingCard(sessionOverrides, eventOverrides)}</Providers>,
  );
}

/** Resolves only when the test says so, to see the "in flight" state. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function confirmCancelSeat() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Cancel seat" }),
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Cancel your seat?" }),
  );
  await userEvent.click(dialog.getByRole("button", { name: "Cancel seat" }));
  return dialog;
}

beforeEach(() => {
  jest.resetAllMocks();
  getMe.mockResolvedValue(account("user", ATTENDEE));
  api.getMine.mockResolvedValue(REGISTERED);
});

describe("SessionBookingCard: who is looking", () => {
  it("asks a guest to sign in and never asks for a standing", async () => {
    getMe.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sign in"));
    renderCard();

    expect(
      await screen.findByRole("link", { name: "Sign in to book" }),
    ).toHaveAttribute("href", AUTH_ROUTES.login);
    expect(api.getMine).not.toHaveBeenCalled();
  });

  it("tells an organizer it cannot book with this account", async () => {
    getMe.mockResolvedValue(account("organizer", ["REGISTRATION_VIEW_EVENT"]));
    renderCard();

    expect(
      await screen.findByText("You can't book with this account"),
    ).toBeInTheDocument();
    expect(api.getMine).not.toHaveBeenCalled();
  });

  it("tells everyone a session without booking needs none", async () => {
    getMe.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sign in"));
    renderCard({ requiresRegistration: false });

    expect(await screen.findByText("No booking needed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says a cancelled event's sessions cannot be booked", async () => {
    renderCard({}, { status: "cancelled" });

    expect(
      await screen.findByText("This event was cancelled"),
    ).toBeInTheDocument();
  });
});

describe("SessionBookingCard: booking a seat (route 8)", () => {
  it("books with one click, with a 'Booking…' state, then shows the seat and how to cancel", async () => {
    const answer = deferred<SessionBookingDto>();
    api.bookSession.mockReturnValue(answer.promise);
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Book session" }),
    );
    expect(screen.getByRole("button", { name: "Booking…" })).toBeDisabled();
    expect(api.bookSession).toHaveBeenCalledTimes(1);
    expect(api.bookSession).toHaveBeenCalledWith(EVENT_ID, SESSION_ID);

    answer.resolve(booking("registered"));

    expect(await screen.findByText("Your seat is booked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel seat" }),
    ).toBeInTheDocument();
    // Taken from the answer: the standing is not asked for again.
    expect(api.getMine).toHaveBeenCalledTimes(1);
  });

  it("says until when a seat can be cancelled, in the event's time zone", async () => {
    const closes = fromNow(10);
    renderCard({}, { registrationClosesAt: closes });

    expect(
      await screen.findByText(
        new RegExp(formatZonedDateTime(closes, "Asia/Kolkata")),
      ),
    ).toBeInTheDocument();
  });

  it("asks a user without an event registration to register first, linking to the event", async () => {
    api.getMine.mockResolvedValue({ registration: null, bookedSessionIds: [] });
    renderCard();

    expect(
      await screen.findByText("Register for the event first"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Register for the event" }),
    ).toHaveAttribute("href", "/events/summit");
    expect(screen.queryByRole("button", { name: "Book session" })).toBeNull();
  });

  it("says the event registration was cancelled", async () => {
    api.getMine.mockResolvedValue({
      registration: { ...ticket, status: "cancelled" },
      bookedSessionIds: [],
    });
    renderCard();

    expect(
      await screen.findByText(/Your event registration was cancelled/),
    ).toBeInTheDocument();
  });

  it("shows 'full' when the server says SESSION_FULL, and reads the standing again", async () => {
    api.bookSession.mockRejectedValue(
      new ApiError(409, "SESSION_FULL", "Full"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Book session" }),
    );

    expect(await screen.findByText("This session is full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book session" })).toBeDisabled();
    await waitFor(() => expect(api.getMine).toHaveBeenCalledTimes(2));
  });

  it("tells a speaker of the session they do not book, linking to My sessions", async () => {
    api.bookSession.mockRejectedValue(
      new ApiError(409, "SPEAKER_CANNOT_BOOK", "Speaker"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Book session" }),
    );

    expect(
      await screen.findByText("You're speaking at this session"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open My sessions" }),
    ).toHaveAttribute("href", "/speaker/sessions");
  });

  it.each([
    ["EVENT_REGISTRATION_REQUIRED", "Register for the event first"],
    ["SESSION_STARTED", "Booking is closed"],
    ["SESSION_CANCELLED", "This session was cancelled"],
    ["SESSION_NOT_BOOKABLE", "Booking opens soon"],
  ])("shows the server's %s answer", async (code, text) => {
    api.bookSession.mockRejectedValue(new ApiError(409, code, code));
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Book session" }),
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("keeps the button for a busy server and says nothing changed, then a retry works", async () => {
    api.bookSession.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Book session" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your booking was not changed.");

    api.bookSession.mockResolvedValue(booking("registered"));
    await userEvent.click(screen.getByRole("button", { name: "Book session" }));

    expect(await screen.findByText("Your seat is booked")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("switches a paid session off without calling the server", async () => {
    renderCard({ price: 50000 });

    expect(
      await screen.findByText("Paid sessions can't be booked yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book session" })).toBeDisabled();
  });

  it("says an online session has no seat limit", async () => {
    renderCard({ mode: "online", hallName: null, seatsLeft: null });

    expect(
      await screen.findByText(/Online session: no seat limit/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book session" })).toBeEnabled();
  });

  it("waits for a hall on an in-person session without one", async () => {
    renderCard({ hallName: null, seatsLeft: null });

    expect(
      await screen.findByText("Seats open once the organiser assigns a hall."),
    ).toBeInTheDocument();
  });

  it("closes booking once the session started", async () => {
    renderCard({ startAt: fromNow(-0.01) });

    expect(await screen.findByText("Booking is closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book session" })).toBeDisabled();
  });

  it("shows a loading line, then an error with a way to try again, for the standing", async () => {
    api.getMine.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderCard();

    expect(
      await screen.findByText("We couldn't load your booking"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "Book session" }),
    ).toBeEnabled();
  });
});

describe("SessionBookingCard: cancelling a seat (route 9)", () => {
  beforeEach(() => {
    api.getMine.mockResolvedValue(BOOKED);
  });

  it("confirms first, names the session and its slot, then releases the seat", async () => {
    api.cancelSessionBooking.mockResolvedValue(booking("cancelled"));
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel seat" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel your seat?" }),
    );
    expect(
      dialog.getByText("Scaling Next.js Applications"),
    ).toBeInTheDocument();
    expect(
      dialog.getByText("Fri 4 Dec 2026 · 10:00 – 10:45 IST · Hall B"),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(/You stay registered for the event/),
    ).toBeInTheDocument();
    expect(api.cancelSessionBooking).not.toHaveBeenCalled();

    await userEvent.click(dialog.getByRole("button", { name: "Cancel seat" }));

    expect(api.cancelSessionBooking).toHaveBeenCalledWith(EVENT_ID, SESSION_ID);
    expect(
      await screen.findByRole("button", { name: "Book session" }),
    ).toBeEnabled();
  });

  it("'Keep seat' closes the dialog without cancelling", async () => {
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel seat" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Keep seat" }));

    expect(api.cancelSessionBooking).not.toHaveBeenCalled();
    expect(screen.getByText("Your seat is booked")).toBeInTheDocument();
  });

  it("shows 'checked in' when the server refuses with ALREADY_CHECKED_IN", async () => {
    api.cancelSessionBooking.mockRejectedValue(
      new ApiError(409, "ALREADY_CHECKED_IN", "Checked in"),
    );
    renderCard();

    await confirmCancelSeat();

    expect(await screen.findByText("You're checked in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel seat" })).toBeNull();
  });

  it("locks the seat when the server says CANCELLATION_CLOSED", async () => {
    api.cancelSessionBooking.mockRejectedValue(
      new ApiError(409, "CANCELLATION_CLOSED", "Closed"),
    );
    renderCard();

    await confirmCancelSeat();

    expect(
      await screen.findByText(/so seats can no longer be cancelled/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel seat" })).toBeNull();
  });

  it("keeps the dialog open with the reason when rate limited", async () => {
    api.cancelSessionBooking.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "slow"),
    );
    renderCard();

    const dialog = await confirmCancelSeat();

    expect(await dialog.findByText(/too often/)).toBeInTheDocument();
    expect(screen.getByText("Your seat is booked")).toBeInTheDocument();
  });

  it("offers no cancel once event registration has closed", async () => {
    renderCard({}, { registrationClosesAt: fromNow(-1) });

    expect(
      await screen.findByText(/so seats can no longer be cancelled/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel seat" })).toBeNull();
  });
});

describe("the event card and the booking card share one standing", () => {
  it("booking a seat updates '0 sessions booked' to '1' on the event card, with no second request", async () => {
    api.bookSession.mockResolvedValue(booking("registered"));
    render(
      <Providers>
        <EventRegistrationCard
          event={{
            id: EVENT_ID,
            status: "published",
            startAt: fromNow(11),
            endAt: fromNow(13),
            timezone: "Asia/Kolkata",
            ticketPrice: 0,
            seatsLeft: 100,
            registrationOpensAt: fromNow(-10),
            registrationClosesAt: fromNow(10),
          }}
          eventTitle="Summit"
        />
        {bookingCard()}
      </Providers>,
    );

    expect(await screen.findByText(/0 sessions booked/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Book session" }));

    expect(await screen.findByText(/1 session booked/)).toBeInTheDocument();
    // Both cards read the same cached standing: one request for the page.
    expect(api.getMine).toHaveBeenCalledTimes(1);
  });
});
