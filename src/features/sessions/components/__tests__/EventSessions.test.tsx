/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import {
  findSampleOverview,
  MEETUP_ID,
  SUMMIT_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventSessionsHref } from "../../../events";
import { sessionApiService } from "../../api/session-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  organizerSessions,
  SPEAKER_ANANYA_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { eventSessionEditHref, eventSessionNewHref } from "../../routes";
import { EventSessions } from "../EventSessions";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { listForEvent: jest.fn(), cancel: jest.fn() },
}));
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { get: jest.fn() },
}));
const venues = jest.mocked(venueApiService);
const events = jest.mocked(eventApiService);
const api = jest.mocked(sessionApiService);
const hasPermission = jest.mocked(useHasPermission);

function sampleOverview(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

/** Shows the sessions page of an event, once its heading has loaded. */
async function renderPage(eventId = SUMMIT_ID) {
  events.getOverview.mockResolvedValue(sampleOverview(eventId));
  const view = renderWithClient(<EventSessions eventId={eventId} />);
  await screen.findByRole("heading", { level: 1 });
  return view;
}

/** The venue's halls, as GET /api/venues/[id] answers: Lab 3 has no session in the samples. */
const venueHalls = [
  {
    id: HALL_A_ID,
    name: "Hall A",
    capacity: 300,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: HALL_B_ID,
    name: "Hall B",
    capacity: 120,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c99",
    name: "Lab 3",
    capacity: 60,
    sortOrder: 3,
    isActive: true,
  },
];

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(true);
  api.listForEvent.mockResolvedValue([...organizerSessions]);
  venues.get.mockResolvedValue({ halls: venueHalls } as never);
});

describe("EventSessions: loading and failing", () => {
  it("shows a skeleton while the event loads, then while the sessions load", async () => {
    events.getOverview.mockResolvedValue(sampleOverview(SUMMIT_ID));
    api.listForEvent.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventSessions eventId={SUMMIT_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("status", { name: "Loading sessions" }),
    ).toBeInTheDocument();
    // The header is already there, so the page does not jump when the rows arrive.
    expect(
      screen.getByRole("heading", { level: 1, name: /Product Engineering/ }),
    ).toBeInTheDocument();
  });

  it("says the event was not found, without a retry", async () => {
    events.getOverview.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Event not found"),
    );
    renderWithClient(<EventSessions eventId={SUMMIT_ID} />);

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(api.listForEvent).not.toHaveBeenCalled();
  });

  it("shows why the sessions failed to load, and loads them again on Try again", async () => {
    const user = userEvent.setup();
    // Every attempt fails: the hook tries a transient error again before it gives up.
    api.listForEvent.mockRejectedValue(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    await renderPage();

    expect(
      await screen.findByText("We couldn't load the sessions"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();

    api.listForEvent.mockResolvedValue([...organizerSessions]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(talk.title)).toBeInTheDocument();
  });
});

describe("EventSessions: the list", () => {
  it("asks for the sessions of this event and shows one row each", async () => {
    await renderPage();

    expect(await screen.findByText(talk.title)).toBeInTheDocument();
    expect(api.listForEvent).toHaveBeenCalledWith(SUMMIT_ID);
    expect(screen.getAllByRole("row")).toHaveLength(
      1 + organizerSessions.length,
    );
  });

  it("shows the slot in the event's zone, the hall, the speakers, the price and the status", async () => {
    await renderPage();

    const row = within(
      (await screen.findByText(talk.title)).closest("tr") as HTMLElement,
    );
    expect(row.getByText("Sat 12 Dec 2026")).toBeInTheDocument();
    expect(row.getByText("10:00 – 11:00 IST")).toBeInTheDocument();
    expect(row.getByText("Hall A")).toBeInTheDocument();
    expect(row.getByText("Ananya Rao")).toBeInTheDocument();
    expect(row.getByText("Included")).toBeInTheDocument();
    expect(row.getByText("Scheduled")).toBeInTheDocument();
  });

  it("shows a hybrid paid draft with both places, both speakers in order and its price", async () => {
    await renderPage();

    const row = within(
      (await screen.findByText(workshop.title)).closest("tr") as HTMLElement,
    );
    expect(row.getByText("Hall B + online")).toBeInTheDocument();
    expect(row.getByText("Ananya Rao, Rohan Mehta")).toBeInTheDocument();
    expect(row.getByText("₹499.50")).toBeInTheDocument();
    expect(row.getByText("Draft")).toBeInTheDocument();
  });

  it("shows a session without a slot as not scheduled yet", async () => {
    api.listForEvent.mockResolvedValue([
      { ...talk, startAt: null, endAt: null, status: "draft" },
    ]);
    await renderPage();

    expect(await screen.findByText("Not scheduled yet")).toBeInTheDocument();
  });

  it("opens the edit page from the title", async () => {
    await renderPage();

    expect(
      await screen.findByRole("link", { name: talk.title }),
    ).toHaveAttribute("href", eventSessionEditHref(SUMMIT_ID, talk.id));
  });

  it("explains an empty event and offers the first session", async () => {
    api.listForEvent.mockResolvedValue([]);
    await renderPage();

    expect(
      await screen.findByText("This event has no sessions yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add the first session" }),
    ).toHaveAttribute("href", eventSessionNewHref(SUMMIT_ID));
  });

  it("links the Sessions tab to this page and marks it current", async () => {
    await renderPage();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    const tab = tabs.getByRole("link", { name: /Sessions/ });
    expect(tab).toHaveAttribute("href", eventSessionsHref(SUMMIT_ID));
    expect(tab).toHaveAttribute("aria-current", "page");
  });
});

describe("EventSessions: adding", () => {
  it("offers Add session when the organizer may create sessions", async () => {
    await renderPage();

    expect(
      await screen.findByRole("link", { name: "Add session" }),
    ).toHaveAttribute("href", eventSessionNewHref(SUMMIT_ID));
    expect(hasPermission).toHaveBeenCalledWith("SESSION_CREATE");
  });

  it("hides Add session without the permission, also in the empty state", async () => {
    hasPermission.mockReturnValue(false);
    api.listForEvent.mockResolvedValue([]);
    await renderPage();

    await screen.findByText("This event has no sessions yet.");
    expect(
      screen.queryByRole("link", { name: /Add (the first )?session/ }),
    ).not.toBeInTheDocument();
  });
});

describe("EventSessions: a read-only event", () => {
  it("has no Add session, no links and no menus, and says why", async () => {
    await renderPage(MEETUP_ID);

    expect(await screen.findByText(talk.title)).toBeInTheDocument();
    expect(screen.getByText("Sessions are read-only")).toBeInTheDocument();
    expect(screen.getByText("This event is cancelled.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Add session" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: talk.title }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Actions for/ }),
    ).not.toBeInTheDocument();
  });
});

describe("EventSessions: row actions", () => {
  it("offers every edit step, and cancel last", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: `Actions for ${talk.title}` }),
    );

    const menu = within(screen.getByRole("menu"));
    const items = menu.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Edit details & speakers",
      "Edit content",
      "Cover image",
      "Cancel session",
    ]);
    expect(
      menu.getByRole("menuitem", { name: "Edit details & speakers" }),
    ).toHaveAttribute("href", eventSessionEditHref(SUMMIT_ID, talk.id));
    expect(menu.getByRole("menuitem", { name: "Cover image" })).toHaveAttribute(
      "href",
      eventSessionEditHref(SUMMIT_ID, talk.id, "cover"),
    );
  });

  it("shows a visible Cancel button on the row that opens the confirm dialog", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(
      await screen.findByRole("button", { name: `Cancel ${talk.title}` }),
    );

    expect(
      screen.getByRole("dialog", { name: "Cancel this session?" }),
    ).toBeInTheDocument();
  });

  it("gives a cancelled session no link and no menu", async () => {
    await renderPage();

    const row = within(
      (await screen.findByText(cancelledKeynote.title)).closest(
        "tr",
      ) as HTMLElement,
    );
    expect(row.getByText("Cancelled")).toBeInTheDocument();
    expect(row.queryByRole("link")).not.toBeInTheDocument();
    expect(row.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EventSessions: one speaker's sessions (?speaker=)", () => {
  async function renderForSpeaker(speakerId: string) {
    events.getOverview.mockResolvedValue(sampleOverview(SUMMIT_ID));
    renderWithClient(
      <EventSessions eventId={SUMMIT_ID} speakerId={speakerId} />,
    );
    await screen.findByRole("heading", { level: 1 });
  }

  it("shows only that speaker's sessions, with their name and the way back to all", async () => {
    await renderForSpeaker(SPEAKER_ANANYA_ID);

    const table = within(await screen.findByRole("table"));
    // Ananya presents the talk and the workshop; the cancelled keynote is Rohan's alone.
    expect(table.getByText(talk.title)).toBeInTheDocument();
    expect(table.getByText(workshop.title)).toBeInTheDocument();
    expect(table.queryByText(cancelledKeynote.title)).not.toBeInTheDocument();
    expect(screen.getByText("Sessions of")).toHaveTextContent(
      "Sessions of Ananya Rao",
    );
    expect(
      screen.getByRole("link", { name: "Show all sessions" }),
    ).toHaveAttribute("href", eventSessionsHref(SUMMIT_ID));
    expect(screen.getByText(/Showing 2 of 3 sessions/)).toBeInTheDocument();
  });

  it("says so when the speaker is on no session of this event", async () => {
    await renderForSpeaker("6b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4dff");

    expect(
      await screen.findByText(
        "This speaker is not on any session of this event.",
      ),
    ).toBeInTheDocument();
  });

  it("shows every session without the filter", async () => {
    await renderPage();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText(cancelledKeynote.title)).toBeInTheDocument();
    expect(screen.queryByText("Show all sessions")).not.toBeInTheDocument();
  });
});

describe("EventSessions: filtering by hall", () => {
  const hallFilter = () =>
    screen.findByRole("combobox", { name: "Filter by hall" });

  /** Opens the dropdown and clicks the row that starts with `name`. */
  async function chooseHall(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.click(await hallFilter());
    await user.click(
      await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
    );
  }

  it("offers the venue's halls in a dropdown, each with how many sessions it holds", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(await hallFilter());

    expect(
      screen.getByRole("option", { name: /^All halls/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Hall A.*1 session/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Hall B.*1 session/ }),
    ).toBeInTheDocument();
    // A hall of the venue with no session is offered too.
    expect(
      screen.getByRole("option", { name: /Lab 3.*0 sessions/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /No hall \(online\).*1 session/ }),
    ).toBeInTheDocument();
  });

  it("asks the event's venue for its halls", async () => {
    await renderPage();
    await hallFilter();

    expect(venues.get).toHaveBeenCalledWith(
      sampleOverview(SUMMIT_ID).event.venue?.id,
    );
  });

  it("shows only the sessions in the chosen hall, in the browser, with no new request", async () => {
    const user = userEvent.setup();
    await renderPage();
    const calls = api.listForEvent.mock.calls.length;

    await chooseHall(user, "Hall A");

    const table = within(screen.getByRole("table"));
    expect(table.getByText(talk.title)).toBeInTheDocument();
    expect(table.queryByText(workshop.title)).not.toBeInTheDocument();
    expect(table.queryByText(cancelledKeynote.title)).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3 sessions")).toBeInTheDocument();
    expect(api.listForEvent).toHaveBeenCalledTimes(calls);
  });

  it("can be searched by typing: the list narrows to the halls that match", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(await hallFilter(), "lab");

    expect(screen.getByRole("option", { name: /Lab 3/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Hall A/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Hall B/ }),
    ).not.toBeInTheDocument();
  });

  it("says there is no match when the search finds no hall", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(await hallFilter(), "zzz");

    expect(screen.getByText("No hall matches your search")).toBeInTheDocument();
  });

  it("shows the sessions with no hall (online) on their own", async () => {
    const user = userEvent.setup();
    await renderPage();

    await chooseHall(user, "No hall");

    const table = within(screen.getByRole("table"));
    expect(table.getByText(cancelledKeynote.title)).toBeInTheDocument();
    expect(table.queryByText(talk.title)).not.toBeInTheDocument();
  });

  it("says no session is in a hall that holds none, and shows them all again on request", async () => {
    const user = userEvent.setup();
    await renderPage();

    await chooseHall(user, "Lab 3");

    expect(screen.getByText("No session is in Lab 3.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show all sessions" }));

    expect(
      within(screen.getByRole("table")).getByText(talk.title),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Showing .* of/)).not.toBeInTheDocument();
  });

  it("goes back to every session with the 'All halls' row", async () => {
    const user = userEvent.setup();
    await renderPage();
    await chooseHall(user, "Hall A");

    await chooseHall(user, "All halls");

    const table = within(screen.getByRole("table"));
    expect(table.getByText(talk.title)).toBeInTheDocument();
    expect(table.getByText(workshop.title)).toBeInTheDocument();
  });

  it("still offers the halls the sessions use when the venue's halls cannot load", async () => {
    const user = userEvent.setup();
    venues.get.mockRejectedValue(new ApiError(503, "UNAVAILABLE", "down"));
    await renderPage();

    await user.click(await hallFilter());

    expect(
      await screen.findByRole("option", { name: /Hall A/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Hall B/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Lab 3/ }),
    ).not.toBeInTheDocument();
  });

  it("has no filter while there is no session to filter", async () => {
    api.listForEvent.mockResolvedValue([]);
    await renderPage();

    await screen.findByText("This event has no sessions yet.");
    expect(
      screen.queryByRole("combobox", { name: "Filter by hall" }),
    ).not.toBeInTheDocument();
  });
});

describe("EventSessions: cancelling", () => {
  async function openCancelDialog(title = talk.title) {
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: `Actions for ${title}` }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Cancel session" }));
    return user;
  }

  it("asks first, and does nothing when the organizer keeps the session", async () => {
    await renderPage();
    const user = await openCancelDialog();

    expect(
      screen.getByRole("dialog", { name: "Cancel this session?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep session" }));

    expect(api.cancel).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("cancels the session, closes the dialog and shows the new list", async () => {
    api.cancel.mockResolvedValue({ ...talk, status: "cancelled" });
    await renderPage();
    const user = await openCancelDialog();
    api.listForEvent.mockResolvedValue([
      cancelledKeynote,
      { ...talk, status: "cancelled" },
      workshop,
    ]);

    await user.click(screen.getByRole("button", { name: "Cancel session" }));

    expect(api.cancel).toHaveBeenCalledWith(SUMMIT_ID, talk.id);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // The list was loaded again: the talk is cancelled now, so it lost its menu.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: `Actions for ${talk.title}` }),
      ).not.toBeInTheDocument(),
    );
    expect(api.listForEvent).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog open and shows why when cancelling fails", async () => {
    api.cancel.mockRejectedValue(
      new ApiError(
        409,
        "SESSION_ENDED",
        "A session that has ended can no longer be cancelled",
      ),
    );
    await renderPage();
    const user = await openCancelDialog();

    await user.click(screen.getByRole("button", { name: "Cancel session" }));

    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "A session that has ended can no longer be cancelled",
    );
    // Nothing changed, so the list is not asked for again.
    expect(api.listForEvent).toHaveBeenCalledTimes(1);
  });

  it("forgets the failure when the dialog is closed and opened for another session", async () => {
    api.cancel.mockRejectedValue(new ApiError(500, "INTERNAL", "Boom"));
    await renderPage();
    const user = await openCancelDialog();
    await user.click(screen.getByRole("button", { name: "Cancel session" }));
    await within(await screen.findByRole("dialog")).findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Keep session" }));
    await user.click(
      await screen.findByRole("button", {
        name: `Actions for ${workshop.title}`,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Cancel session" }));

    expect(
      within(screen.getByRole("dialog")).queryByRole("alert"),
    ).not.toBeInTheDocument();
  });
});
