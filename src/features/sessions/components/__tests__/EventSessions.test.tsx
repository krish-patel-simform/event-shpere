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
import {
  cancelledKeynote,
  organizerSessions,
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

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(true);
  api.listForEvent.mockResolvedValue([...organizerSessions]);
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
      "Edit details",
      "Edit speakers",
      "Edit content",
      "Cover image",
      "Cancel session",
    ]);
    expect(
      menu.getByRole("menuitem", { name: "Edit speakers" }),
    ).toHaveAttribute(
      "href",
      eventSessionEditHref(SUMMIT_ID, talk.id, "speakers"),
    );
    expect(menu.getByRole("menuitem", { name: "Cover image" })).toHaveAttribute(
      "href",
      eventSessionEditHref(SUMMIT_ID, talk.id, "cover"),
    );
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
