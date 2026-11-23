/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { registrationApiService } from "../../api/registration-api.service";
import type { MyTicketDto } from "../../schemas/registrations.schemas";
import { MyTickets } from "../MyTickets";

jest.mock("../../api/registration-api.service", () => ({
  registrationApiService: { listMyTickets: jest.fn(), cancel: jest.fn() },
}));
const api = jest.mocked(registrationApiService);

const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

let nextId = 0;
/** A live ticket for an event in 13 days, registration closing in 10, unless told otherwise. */
const ticket = (
  overrides: {
    registration?: Partial<MyTicketDto["registration"]>;
    event?: Partial<MyTicketDto["event"]>;
    bookedSessionCount?: number;
  } = {},
): MyTicketDto => {
  nextId += 1;
  const suffix = String(nextId).padStart(12, "0");
  const eventId = `6a7b8c9d-0e1f-4a2b-8c3d-${suffix}`;
  return {
    registration: {
      id: `1b2c3d4e-5f6a-4b7c-8d9e-${suffix}`,
      eventId,
      status: "registered",
      ticketCode: `ESEVT${nextId}K3Q9P`,
      amount: 0,
      currency: "INR",
      reason: "free",
      registeredAt: fromNow(-5),
      ...overrides.registration,
    },
    event: {
      id: eventId,
      slug: `event-${nextId}`,
      title: `Event ${nextId}`,
      status: "published",
      startAt: fromNow(13),
      endAt: fromNow(15),
      timezone: "Asia/Kolkata",
      registrationClosesAt: fromNow(10),
      venueName: "Convention Centre",
      venueCity: "Pune",
      ...overrides.event,
    },
    bookedSessionCount: overrides.bookedSessionCount ?? 3,
  };
};

const page = (items: MyTicketDto[], total = items.length) => ({
  items,
  meta: { page: 1, pageSize: 10, total },
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MyTickets />
    </QueryClientProvider>,
  );
}

const rows = () => within(screen.getByRole("list", { name: "Tickets" }));

beforeEach(() => {
  jest.resetAllMocks();
  nextId = 0;
});

describe("MyTickets: the list", () => {
  it("shows a skeleton, asking for upcoming tickets of every status, first page", () => {
    api.listMyTickets.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading tickets" }),
    ).toBeInTheDocument();
    expect(api.listMyTickets).toHaveBeenCalledWith({
      when: "upcoming",
      status: "all",
      page: 1,
      pageSize: 10,
    });
  });

  it("shows each ticket: event link, dates, place, status, how soon, code and sessions", async () => {
    const live = ticket();
    api.listMyTickets.mockResolvedValue(page([live]));
    renderPage();

    const link = await screen.findByRole("link", { name: "Event 1" });
    expect(link).toHaveAttribute("href", "/events/event-1");
    const list = rows();
    expect(list.getByText(/Convention Centre, Pune/)).toBeInTheDocument();
    expect(list.getByText("Registered")).toBeInTheDocument();
    expect(list.getByText("In 13 days")).toBeInTheDocument();
    expect(list.getByText(live.registration.ticketCode)).toBeInTheDocument();
    expect(list.getByText("3 sessions booked")).toBeInTheDocument();
    expect(
      list.getByRole("button", { name: "Show ticket" }),
    ).toBeInTheDocument();
    expect(list.getByRole("link", { name: "View event" })).toHaveAttribute(
      "href",
      "/events/event-1",
    );
    expect(
      list.getByRole("button", { name: "Cancel registration for Event 1" }),
    ).toBeInTheDocument();
  });

  it("puts the count on the selected tab only (the API counts one filter)", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()], 5));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    expect(
      screen.getByRole("tab", { name: /Current & upcoming/ }),
    ).toHaveTextContent("5");
    expect(screen.getByRole("tab", { name: /Past/ })).not.toHaveTextContent(
      /\d/,
    );
  });

  it("names the tabs Current & upcoming, Past and All, the first one selected", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()]));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent?.replace(/\d+$/, ""))).toEqual([
      "Current & upcoming",
      "Past",
      "All",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("shows an event running now under Current & upcoming, first, as 'Happening now', with no cancel", async () => {
    // The server's order for this tab (soonest start first) puts the running event on top.
    const running = ticket({
      event: {
        startAt: fromNow(-1),
        endAt: fromNow(1),
        registrationClosesAt: fromNow(-2),
      },
    });
    api.listMyTickets.mockResolvedValue(page([running, ticket()]));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    const [first, second] = within(
      screen.getByRole("list", { name: "Tickets" }),
    ).getAllByRole("listitem");
    expect(within(first!).getByText("Happening now")).toBeInTheDocument();
    // Its ticket is still there to show at the door, but cancelling closed at the start.
    expect(
      within(first!).getByRole("button", { name: "Show ticket" }),
    ).toBeInTheDocument();
    expect(
      within(first!).queryByRole("button", { name: /Cancel registration/ }),
    ).toBeNull();
    expect(within(second!).getByText("In 13 days")).toBeInTheDocument();
  });

  it("asks again for Past from page 1, with a skeleton, not the old rows", async () => {
    api.listMyTickets.mockResolvedValueOnce(page([ticket()]));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    api.listMyTickets.mockReturnValue(new Promise(() => {}));
    await userEvent.click(screen.getByRole("tab", { name: /Past/ }));

    expect(api.listMyTickets).toHaveBeenLastCalledWith({
      when: "past",
      status: "all",
      page: 1,
      pageSize: 10,
    });
    expect(
      screen.getByRole("status", { name: "Loading tickets" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Event 1" })).toBeNull();
  });

  it("filters by status, back to page 1", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()], 25));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() =>
      expect(api.listMyTickets).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );

    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");

    expect(api.listMyTickets).toHaveBeenLastCalledWith({
      when: "upcoming",
      status: "cancelled",
      page: 1,
      pageSize: 10,
    });
  });

  it("has no pagination for a single page", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()]));
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("shows 'Online' for an event without a venue", async () => {
    api.listMyTickets.mockResolvedValue(
      page([ticket({ event: { venueName: null, venueCity: null } })]),
    );
    renderPage();

    expect(await screen.findByText(/· Online/)).toBeInTheDocument();
  });
});

describe("MyTickets: empty and failed", () => {
  it("says there are no current or upcoming tickets, with a way to browse events", async () => {
    api.listMyTickets.mockResolvedValue(page([]));
    renderPage();

    expect(
      await screen.findByText("No current or upcoming tickets"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tabpanel")).getByRole("link", {
        name: "Browse events",
      }),
    ).toHaveAttribute("href", "/events");
  });

  it("offers to show every status when a status filter found nothing", async () => {
    api.listMyTickets.mockResolvedValue(page([]));
    renderPage();
    await screen.findByText("No current or upcoming tickets");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "cancelled");
    expect(
      await screen.findByText("No current or upcoming cancelled tickets"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Show all statuses" }),
    );
    expect(screen.getByLabelText("Status")).toHaveValue("all");
  });

  it("shows the error with a way to try again", async () => {
    api.listMyTickets.mockRejectedValueOnce(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Service unavailable"),
    );
    renderPage();

    expect(
      await screen.findByText("We couldn't load your tickets"),
    ).toBeInTheDocument();
    api.listMyTickets.mockResolvedValue(page([ticket()]));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("link", { name: "Event 1" }),
    ).toBeInTheDocument();
  });
});

describe("MyTickets: cancelled tickets", () => {
  it("says the organizer cancelled the event, with no ticket or cancel", async () => {
    api.listMyTickets.mockResolvedValue(
      page([
        ticket({
          event: { status: "cancelled" },
          registration: { status: "cancelled" },
        }),
      ]),
    );
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    const list = rows();
    expect(list.getByText("Registration cancelled")).toBeInTheDocument();
    expect(list.getByText("Event cancelled")).toBeInTheDocument();
    expect(
      list.getByText(/The organiser cancelled this event/),
    ).toBeInTheDocument();
    expect(list.queryByRole("button", { name: "Show ticket" })).toBeNull();
    expect(
      list.queryByRole("button", { name: /Cancel registration/ }),
    ).toBeNull();
    expect(list.queryByRole("link", { name: "Register again" })).toBeNull();
  });

  it("offers 'Register again' (to the event page) for a ticket the user cancelled", async () => {
    api.listMyTickets.mockResolvedValue(
      page([ticket({ registration: { status: "cancelled" } })]),
    );
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Register again" }),
    ).toHaveAttribute("href", "/events/event-1");
    expect(
      screen.getByText(/You cancelled this registration/),
    ).toBeInTheDocument();
  });

  it("has no 'Register again' once that event ended", async () => {
    api.listMyTickets.mockResolvedValue(
      page([
        ticket({
          registration: { status: "cancelled" },
          event: { startAt: fromNow(-3), endAt: fromNow(-2) },
        }),
      ]),
    );
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    expect(screen.queryByRole("link", { name: "Register again" })).toBeNull();
  });
});

describe("MyTickets: show and cancel a ticket", () => {
  it("shows the ticket code in a dialog", async () => {
    const live = ticket();
    api.listMyTickets.mockResolvedValue(page([live]));
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Show ticket" }),
    );

    const dialog = within(screen.getByRole("dialog", { name: "Your ticket" }));
    expect(
      dialog.getByLabelText(`Ticket code ${live.registration.ticketCode}`),
    ).toBeInTheDocument();
    expect(dialog.getByText("Event 1")).toBeInTheDocument();
  });

  it("cancels after confirming, says so, and reads the list again", async () => {
    const live = ticket();
    api.listMyTickets.mockResolvedValue(page([live]));
    api.cancel.mockResolvedValue({
      registration: { ...live.registration, status: "cancelled" },
      bookedSessionIds: [],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancel registration for Event 1",
      }),
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel your registration?" }),
    );
    expect(
      dialog.getByText("Your 3 session seats are cancelled too."),
    ).toBeInTheDocument();
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel registration" }),
    );

    expect(api.cancel).toHaveBeenCalledWith(live.event.id);
    expect(
      await screen.findByText("Your registration for Event 1 was cancelled"),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.listMyTickets).toHaveBeenCalledTimes(2));
  });

  it("explains a closed window in the dialog and offers only Close", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()]));
    api.cancel.mockRejectedValue(
      new ApiError(409, "CANCELLATION_CLOSED", "Closed"),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancel registration for Event 1",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel registration" }),
    );

    expect(
      await dialog.findByText(/can no longer be cancelled/),
    ).toBeInTheDocument();
    expect(
      dialog.queryByRole("button", { name: "Cancel registration" }),
    ).toBeNull();
    // The footer's "Close" (the X in the corner is also named Close).
    const closeButtons = dialog.getAllByRole("button", { name: "Close" });
    await userEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(
      screen.queryByRole("dialog", { name: "Cancel your registration?" }),
    ).toBeNull();
  });

  it("keeps 'Cancel registration' on a rate limit, so it can be tried again", async () => {
    api.listMyTickets.mockResolvedValue(page([ticket()]));
    api.cancel.mockRejectedValue(new ApiError(429, "RATE_LIMITED", "slow"));
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancel registration for Event 1",
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.click(
      dialog.getByRole("button", { name: "Cancel registration" }),
    );

    expect(await dialog.findByText(/too often/)).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "Cancel registration" }),
    ).toBeEnabled();
  });

  it("offers no cancel once registration has closed", async () => {
    api.listMyTickets.mockResolvedValue(
      page([ticket({ event: { registrationClosesAt: fromNow(-1) } })]),
    );
    renderPage();
    await screen.findByRole("link", { name: "Event 1" });

    expect(
      screen.queryByRole("button", { name: /Cancel registration/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show ticket" }),
    ).toBeInTheDocument();
  });
});
