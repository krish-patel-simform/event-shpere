/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
} from "../../schemas/registrations.schemas";
import type { RegistrationCardEvent } from "../../utils/registration-card-state";
import { EventRegistrationCard } from "../EventRegistrationCard";

jest.mock("@/src/features/auth/api/auth-api.service", () => ({
  authApiService: { getMe: jest.fn() },
}));
jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: {
    register: jest.fn(),
    getMine: jest.fn(),
    cancel: jest.fn(),
  },
}));
const getMe = jest.mocked(authApiService.getMe);
const api = jest.mocked(registrationApiService);

const EVENT_ID = "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d";
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

/** Registration opened 10 days ago and closes in 10; the event runs in 11 to 13 days. */
const event = (
  overrides: Partial<RegistrationCardEvent> = {},
): RegistrationCardEvent => ({
  id: EVENT_ID,
  status: "published",
  startAt: fromNow(11),
  endAt: fromNow(13),
  timezone: "Asia/Kolkata",
  ticketPrice: 0,
  seatsLeft: 120,
  registrationOpensAt: fromNow(-10),
  registrationClosesAt: fromNow(10),
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

const NOT_REGISTERED: MyRegistrationDto = {
  registration: null,
  bookedSessionIds: [],
};
const REGISTERED_WITH_TWO_SEATS: MyRegistrationDto = {
  registration: ticket,
  bookedSessionIds: [
    "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01",
    "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f02",
  ],
};

const ATTENDEE_PERMISSIONS: PermissionCode[] = [
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

function renderCard(eventOverrides: Partial<RegistrationCardEvent> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PermissionProvider>
        <EventRegistrationCard
          event={event(eventOverrides)}
          eventTitle="Product Engineering Summit 2026"
        />
      </PermissionProvider>
    </QueryClientProvider>,
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

beforeEach(() => {
  jest.resetAllMocks();
  getMe.mockResolvedValue(account("user", ATTENDEE_PERMISSIONS));
  api.getMine.mockResolvedValue(NOT_REGISTERED);
});

describe("EventRegistrationCard: who is looking", () => {
  it("asks a guest to sign in, and never asks the server for a standing", async () => {
    getMe.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sign in"));
    renderCard();

    expect(
      await screen.findByRole("link", { name: "Sign in to register" }),
    ).toHaveAttribute("href", AUTH_ROUTES.login);
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", AUTH_ROUTES.signup);
    expect(api.getMine).not.toHaveBeenCalled();
  });

  it.each([
    ["organizer", ["EVENT_CREATE", "REGISTRATION_VIEW_EVENT"]],
    ["admin", ["EVENT_MANAGE_ALL", "REGISTRATION_VIEW_ALL"]],
  ] as const)(
    "tells an %s account it cannot register, without calling route 2",
    async (role, permissions) => {
      getMe.mockResolvedValue(account(role, [...permissions]));
      renderCard();

      expect(
        await screen.findByText("You can't register with this account"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Register/ })).toBeNull();
      expect(api.getMine).not.toHaveBeenCalled();
    },
  );

  it("says the account could not be checked (a 500, not a 401) and can try again", async () => {
    getMe.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "boom"));
    renderCard();

    await screen.findByText("We couldn't check your account");
    getMe.mockResolvedValue(account("user", ATTENDEE_PERMISSIONS));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "Register for free" }),
    ).toBeEnabled();
  });

  it("shows a cancelled event to everyone, without asking for a standing", async () => {
    renderCard({ status: "cancelled" });

    expect(
      await screen.findByText("This event was cancelled"),
    ).toBeInTheDocument();
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Register/ })).toBeNull();
  });
});

describe("EventRegistrationCard: registering (route 1)", () => {
  it("registers with one click and shows the ticket, with a 'Registering…' state in between", async () => {
    const answer = deferred<RegistrationDto>();
    api.register.mockReturnValue(answer.promise);
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Register for free" }),
    );

    // In flight: one click only, the button is switched off and says so.
    expect(screen.getByRole("button", { name: "Registering…" })).toBeDisabled();
    expect(
      screen.getByText("Please wait. Do not close this page."),
    ).toBeInTheDocument();
    expect(api.register).toHaveBeenCalledTimes(1);
    expect(api.register).toHaveBeenCalledWith(EVENT_ID);

    answer.resolve(ticket);

    expect(await screen.findByText("You're registered")).toBeInTheDocument();
    expect(screen.getByText("ESEVT7K3Q9P")).toBeInTheDocument();
    expect(screen.getByText(/0 sessions booked/)).toBeInTheDocument();
  });

  it("says when registration closes, in the event's time zone", async () => {
    const closes = fromNow(10);
    renderCard({ registrationClosesAt: closes });

    expect(
      await screen.findByText(
        `Registration closes ${formatZonedDateTime(closes, "Asia/Kolkata")}. Book sessions after you register.`,
      ),
    ).toBeInTheDocument();
  });

  it("shows 'full' when the server says EVENT_FULL though the page still showed seats, and reads the standing again", async () => {
    api.register.mockRejectedValue(
      new ApiError(409, "EVENT_FULL", "This event is full"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Register for free" }),
    );

    expect(await screen.findByText("This event is full")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register for free" }),
    ).toBeDisabled();
    await waitFor(() => expect(api.getMine).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["REGISTRATION_CLOSED", "Registration is closed"],
    ["REGISTRATION_NOT_OPEN", "Registration opens soon"],
    ["EVENT_ENDED", "This event has ended"],
    ["EVENT_CANCELLED", "This event was cancelled"],
  ])("shows the server's %s answer", async (code, text) => {
    api.register.mockRejectedValue(new ApiError(409, code, code));
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Register for free" }),
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("keeps the button for a busy server (503) and says nothing changed", async () => {
    api.register.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "busy"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Register for free" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't complete that");
    expect(alert).toHaveTextContent("Your registration was not changed.");

    // Trying again works and clears the message.
    api.register.mockResolvedValue(ticket);
    await userEvent.click(
      screen.getByRole("button", { name: "Register for free" }),
    );
    expect(await screen.findByText("You're registered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a rate limit (429)", async () => {
    api.register.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Register for free" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/too often/);
  });

  it("on a paid event offers 'Register' and explains, then shows the server's PAYMENT_NOT_AVAILABLE_YET", async () => {
    api.register.mockRejectedValue(
      new ApiError(409, "PAYMENT_NOT_AVAILABLE_YET", "Paid tickets later"),
    );
    renderCard({ ticketPrice: 150000 });

    expect(
      await screen.findByText(/Speakers of this event can register for free/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("Paid tickets are not available yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeDisabled();
  });

  it("switches the button off before registration opens", async () => {
    renderCard({ registrationOpensAt: fromNow(2) });

    expect(
      await screen.findByText("Registration opens soon"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register for free" }),
    ).toBeDisabled();
  });

  it("switches the button off with no seats left", async () => {
    renderCard({ seatsLeft: 0 });

    expect(await screen.findByText("This event is full")).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it("offers 'Register again' after a cancelled registration", async () => {
    api.getMine.mockResolvedValue({
      registration: { ...ticket, status: "cancelled" },
      bookedSessionIds: [],
    });
    renderCard();

    expect(
      await screen.findByText("You cancelled your registration"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Register again" }),
    ).toBeEnabled();
    expect(
      screen.getByText(/Your session seats are not restored/),
    ).toBeInTheDocument();
  });
});

describe("EventRegistrationCard: the standing (route 2)", () => {
  it("shows a loading line while the standing loads", async () => {
    api.getMine.mockReturnValue(new Promise(() => {}));
    renderCard();

    expect(
      await screen.findByText("Checking your registration…"),
    ).toBeInTheDocument();
  });

  it("shows an error with a way to try again", async () => {
    api.getMine.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderCard();

    expect(
      await screen.findByText("We couldn't load your registration"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("button", { name: "Register for free" }),
    ).toBeInTheDocument();
  });

  it("shows a speaker's complimentary ticket", async () => {
    api.getMine.mockResolvedValue({
      registration: { ...ticket, reason: "complimentary_speaker" },
      bookedSessionIds: [],
    });
    renderCard({ ticketPrice: 150000 });

    expect(
      await screen.findByText(/Complimentary speaker ticket/),
    ).toBeInTheDocument();
  });
});

describe("EventRegistrationCard: the ticket and cancelling (route 3)", () => {
  beforeEach(() => {
    api.getMine.mockResolvedValue(REGISTERED_WITH_TWO_SEATS);
  });

  it("shows the ticket code big in a dialog, and copies it", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderCard();

    await user.click(
      await screen.findByRole("button", { name: "View ticket" }),
    );
    const dialog = within(screen.getByRole("dialog", { name: "Your ticket" }));
    expect(
      dialog.getByLabelText("Ticket code ESEVT7K3Q9P"),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("ESEVT7K3Q9P");
    expect(await dialog.findByText("Code copied.")).toBeInTheDocument();
  });

  it("says so when the browser refuses to copy", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    renderCard();

    await user.click(
      await screen.findByRole("button", { name: "View ticket" }),
    );
    await user.click(screen.getByRole("button", { name: "Copy code" }));

    expect(
      await screen.findByText(/Could not copy. Select the code/),
    ).toBeInTheDocument();
  });

  it("confirms first, says what is lost, then cancels and offers 'Register again'", async () => {
    api.cancel.mockResolvedValue({
      registration: { ...ticket, status: "cancelled" },
      bookedSessionIds: [],
    });
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel registration" }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel your registration?" }),
    );
    expect(
      dialog.getByText("Your 2 session seats are cancelled too."),
    ).toBeInTheDocument();
    expect(api.cancel).not.toHaveBeenCalled();

    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel registration" }),
    );

    expect(api.cancel).toHaveBeenCalledWith(EVENT_ID);
    expect(
      await screen.findByRole("button", { name: "Register again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Cancel your registration?" }),
    ).toBeNull();
  });

  it("'Keep registration' closes the dialog without cancelling", async () => {
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel registration" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Keep registration" }),
    );

    expect(api.cancel).not.toHaveBeenCalled();
    expect(screen.getByText("You're registered")).toBeInTheDocument();
  });

  it("shows 'checked in' when the server refuses with ALREADY_CHECKED_IN, and no more cancel", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(409, "ALREADY_CHECKED_IN", "Checked in"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel registration" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel registration",
      }),
    );

    expect(await screen.findByText("You're checked in")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel registration" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "View my schedule" }),
    ).toBeInTheDocument();
  });

  it("locks the ticket when the server says CANCELLATION_CLOSED (its clock wins)", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(409, "CANCELLATION_CLOSED", "Closed"),
    );
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel registration" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel registration",
      }),
    );

    expect(
      await screen.findByText(/so this ticket can no longer be cancelled/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel registration" }),
    ).toBeNull();
  });

  it("keeps the dialog open with the reason when rate limited, and nothing changes", async () => {
    api.cancel.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "slow"));
    renderCard();

    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel registration" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel registration" }),
    );

    expect(await dialog.findByText(/too often/)).toBeInTheDocument();
    expect(screen.getByText("You're registered")).toBeInTheDocument();
  });

  it("offers no cancel once registration has closed", async () => {
    renderCard({ registrationClosesAt: fromNow(-1) });

    expect(
      await screen.findByText(/so this ticket can no longer be cancelled/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel registration" }),
    ).toBeNull();
  });
});
