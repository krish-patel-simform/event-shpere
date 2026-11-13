/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { speakersApiService } from "@/src/features/speakers/api/speakers-api.service";
import {
  FINTECH_ID,
  findSampleOverview,
  MEETUP_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventSessionNewHref } from "../../../events";
import { ananya, meera } from "../../../speakers/__fixtures__/speakers";
import {
  cancelledKeynote,
  SPEAKER_ANANYA_ID,
  SPEAKER_ROHAN_ID,
  talk,
  workshop,
} from "../../__fixtures__/organizer-sessions";
import { eventSessionsOfSpeakerHref } from "../../routes";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionApiService } from "../../api/session-api.service";
import { EventSpeakers } from "../EventSpeakers";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { listForEvent: jest.fn() },
}));
jest.mock("@/src/features/speakers/api/speakers-api.service", () => ({
  speakersApiService: { list: jest.fn() },
}));

const events = jest.mocked(eventApiService);
const sessionsApi = jest.mocked(sessionApiService);
const speakers = jest.mocked(speakersApiService);

function overviewOf(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

beforeEach(() => {
  jest.resetAllMocks();
  events.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
  sessionsApi.listForEvent.mockResolvedValue([
    talk,
    workshop,
    cancelledKeynote,
  ]);
  speakers.list.mockResolvedValue({
    items: [ananya, meera],
    meta: { page: 1, pageSize: 50, total: 2 },
  });
});

async function renderSpeakers() {
  renderWithClient(<EventSpeakers eventId={FINTECH_ID} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("EventSpeakers", () => {
  it("marks the Speakers tab as current", async () => {
    await renderSpeakers();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Speakers/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("lists only the speakers of this event's sessions, with their sessions", async () => {
    await renderSpeakers();

    const table = within(
      await screen.findByRole("table", { name: "Speakers of this event" }),
    );
    // Ananya and Rohan present the live sessions; the cancelled one adds nobody.
    expect(table.getByText("Ananya Rao")).toBeInTheDocument();
    expect(table.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(table.getByText(new RegExp(talk.title))).toBeInTheDocument();
    expect(table.getAllByRole("row")).toHaveLength(3);
  });

  it("has one row action, View sessions, which opens the Sessions tab on that speaker (in the URL)", async () => {
    const user = userEvent.setup();
    await renderSpeakers();

    await user.click(
      await screen.findByRole("button", { name: "Actions for Ananya Rao" }),
    );

    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    // The menu used to offer a second action, "Add to a new session": it is gone.
    expect(items.map((item) => item.textContent)).toEqual(["View sessions"]);
    expect(items[0]).toHaveAttribute(
      "href",
      eventSessionsOfSpeakerHref(FINTECH_ID, SPEAKER_ANANYA_ID),
    );
    expect(items[0]?.getAttribute("href")).toContain(
      `?speaker=${SPEAKER_ANANYA_ID}`,
    );
  });

  it("asks the speakers API only for the speakers on screen, by id, in one request", async () => {
    await renderSpeakers();
    await screen.findByRole("table", { name: "Speakers of this event" });

    await waitFor(() => expect(speakers.list).toHaveBeenCalledTimes(1));
    // Ananya and Rohan are the two rows; their ids are sent sorted, with the page size they need.
    expect(speakers.list).toHaveBeenCalledWith({
      ids: [SPEAKER_ANANYA_ID, SPEAKER_ROHAN_ID].sort(),
      pageSize: 2,
    });
  });

  it("shows whether each profile is complete", async () => {
    await renderSpeakers();

    const table = within(
      await screen.findByRole("table", { name: "Speakers of this event" }),
    );
    expect(await table.findByText("Complete")).toBeInTheDocument();
    // Rohan is not in the answer, so his profile is unknown: no badge.
    expect(table.queryByText("Missing photo")).not.toBeInTheDocument();
  });

  it("marks a speaker whose profile has no photo", async () => {
    speakers.list.mockResolvedValue({
      items: [{ ...ananya, profile: meera.profile }],
      meta: { page: 1, pageSize: 2, total: 1 },
    });
    await renderSpeakers();

    expect(await screen.findByText("Missing photo")).toBeInTheDocument();
  });

  it("shows the rows even when the profiles cannot be loaded", async () => {
    speakers.list.mockRejectedValue(new ApiError(500, "INTERNAL", "down"));
    await renderSpeakers();

    const table = within(
      await screen.findByRole("table", { name: "Speakers of this event" }),
    );
    expect(table.getByText("Ananya Rao")).toBeInTheDocument();
    expect(
      await table.findAllByTitle("The profile could not be loaded"),
    ).toHaveLength(2);
  });

  it("searches the names in the browser", async () => {
    const user = userEvent.setup();
    await renderSpeakers();
    await screen.findByRole("table", { name: "Speakers of this event" });

    await user.type(
      screen.getByRole("searchbox", { name: "Search assigned speakers" }),
      "rohan",
    );

    const table = within(
      screen.getByRole("table", { name: "Speakers of this event" }),
    );
    expect(table.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(table.queryByText("Ananya Rao")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText(/No speaker matches/)).toBeInTheDocument();
  });

  it("says there are none, with a way to add a session, when the event has no session", async () => {
    sessionsApi.listForEvent.mockResolvedValue([]);
    await renderSpeakers();

    expect(await screen.findByText("No speakers yet")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Add a session" })[0],
    ).toHaveAttribute("href", eventSessionNewHref(FINTECH_ID));
  });

  it("offers no way to add a session on an event that cannot change", async () => {
    events.getOverview.mockResolvedValue(overviewOf(MEETUP_ID));
    sessionsApi.listForEvent.mockResolvedValue([]);
    renderWithClient(<EventSpeakers eventId={MEETUP_ID} />);

    expect(await screen.findByText("No speakers yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Add a session" }),
    ).not.toBeInTheDocument();
  });

  it("shows a skeleton while the sessions load", async () => {
    sessionsApi.listForEvent.mockReturnValue(new Promise(() => {}));
    await renderSpeakers();

    expect(
      await screen.findByRole("status", { name: "Loading speakers" }),
    ).toBeInTheDocument();
  });

  it("shows the server's message when the sessions fail, and can try again", async () => {
    const user = userEvent.setup();
    sessionsApi.listForEvent.mockRejectedValue(
      new ApiError(500, "INTERNAL", "Something broke"),
    );
    await renderSpeakers();

    expect(
      await screen.findByText("We couldn't load the speakers"),
    ).toBeInTheDocument();
    sessionsApi.listForEvent.mockResolvedValue([talk]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Ananya Rao")).toBeInTheDocument();
  });
});
