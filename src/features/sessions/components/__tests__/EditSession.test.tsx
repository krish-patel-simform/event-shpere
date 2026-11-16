/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { speakersApiService } from "@/src/features/speakers/api/speakers-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FINTECH_ID,
  findSampleOverview,
  MEETUP_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventSessionsHref } from "../../../events";
import { ananya, meera } from "../../../speakers/__fixtures__/speakers";
import {
  cancelledKeynote,
  HALL_A_ID,
  HALL_B_ID,
  SPEAKER_ANANYA_ID,
  talk,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { sessionQueryKeys } from "../../hooks/session-cache";
import { sessionApiService } from "../../api/session-api.service";
import { eventSessionEditHref, type SessionStep } from "../../routes";
import type { SessionContentDto } from "../../schemas/session-content.schemas";
import type { SessionDto } from "../../schemas/sessions.schemas";
import { EditSession } from "../EditSession";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: {
    get: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    replaceSpeakers: jest.fn(),
    getContent: jest.fn(),
    updateContent: jest.fn(),
    uploadCover: jest.fn(),
    deleteCover: jest.fn(),
  },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { getHallAvailability: jest.fn() },
}));
jest.mock("@/src/features/speakers/api/speakers-api.service", () => ({
  speakersApiService: { list: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const events = jest.mocked(eventApiService);
const api = jest.mocked(sessionApiService);
const venues = jest.mocked(venueApiService);
const speakers = jest.mocked(speakersApiService);

/** The fintech event (12 Dec 2026, a draft) holds the sample talk (12 Dec, 10:00 – 11:00 IST). */
const session: SessionDto = { ...talk, eventId: FINTECH_ID };

const content = (
  overrides: Partial<SessionContentDto> = {},
): SessionContentDto => ({
  description: "How to build apps that work offline.",
  prerequisites: "Basic TypeScript",
  resources: [{ label: "Slides", url: "https://example.com/slides" }],
  coverImage: null,
  ...overrides,
});

function overviewOf(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

/** Renders one step of the edit page, once the session has loaded. */
async function renderStep(step: SessionStep, eventId = FINTECH_ID) {
  renderWithClient(
    <EditSession eventId={eventId} sessionId={session.id} step={step} />,
  );
  // The heading shows while the session still loads; the steps show once it is there.
  await screen.findByRole("navigation", { name: "Session steps" });
}

beforeEach(() => {
  jest.resetAllMocks();
  events.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
  api.get.mockResolvedValue(session);
  api.getContent.mockResolvedValue(content());
  venues.getHallAvailability.mockResolvedValue(
    [
      { id: HALL_A_ID, name: "Hall A", capacity: 300 },
      { id: HALL_B_ID, name: "Hall B", capacity: 120 },
    ].map((hall) => ({ ...hall, busy: false, bookedSlots: [] })),
  );
  speakers.list.mockResolvedValue({
    items: [ananya, meera],
    meta: { page: 1, pageSize: 50, total: 2 },
  });
});

describe("EditSession: the page", () => {
  it("shows a skeleton while the event loads, then while the session loads", async () => {
    events.getOverview.mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );
    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
  });

  it("shows a skeleton while the session loads", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(FINTECH_ID, session.id);
  });

  it("says where you are, with the way back to the sessions", async () => {
    await renderStep("details");

    const trail = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(trail.getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "href",
      eventSessionsHref(FINTECH_ID),
    );
    // The trail ends at the session's name.
    expect(trail.getByText(session.title)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("names the session in the header, and the event under it", async () => {
    await renderStep("details");

    expect(
      screen.getByRole("heading", { level: 1, name: session.title }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Edit session" }),
    ).not.toBeInTheDocument();
    // The event's name is the line under the title (and in the trail).
    expect(screen.getAllByText("Fintech Product Forum").length).toBeGreaterThan(
      1,
    );
  });

  it("never says 'Edit session': with no name known yet, a placeholder holds the place while the session loads", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit session")).not.toBeInTheDocument();
  });

  it("shows the session's name at once when the Sessions list already has it, before the session loads", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const { client } = renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );
    // What the Sessions list the organizer came from left in the cache.
    client.setQueryData(sessionQueryKeys.list(FINTECH_ID), [session]);

    expect(
      await screen.findByRole("heading", { level: 1, name: session.title }),
    ).toBeInTheDocument();
    // Only the name is taken from the list: the form still waits for the session itself.
    expect(
      screen.getByRole("status", { name: "Loading session" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Session title")).not.toBeInTheDocument();
  });

  it("opens straight on the form when the session is already in the cache (just added)", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const { client } = renderWithClient(
      <EditSession
        eventId={FINTECH_ID}
        sessionId={session.id}
        step="content"
      />,
    );
    client.setQueryData(
      sessionQueryKeys.detail(FINTECH_ID, session.id),
      session,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: session.title }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("navigation", { name: "Session steps" }),
    ).toBeInTheDocument();
  });

  it("says 'Session' in the header when the session cannot be found", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Session not found"),
    );
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Session" }),
    ).toBeInTheDocument();
  });

  it("has three steps, each a link, with the current one marked", async () => {
    await renderStep("content");

    const steps = within(
      screen.getByRole("navigation", { name: "Session steps" }),
    );
    expect(
      steps.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(
      (["details", "content", "cover"] as const).map((step) =>
        eventSessionEditHref(FINTECH_ID, session.id, step),
      ),
    );
    expect(steps.getByRole("link", { name: /Content/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    // There is no Speakers step: who presents is part of the details.
    expect(
      steps.queryByRole("link", { name: /^Speakers/ }),
    ).not.toBeInTheDocument();
  });

  it("says so when the session is not in this event (404)", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Session not found"),
    );
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByText("Session not found", { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sessions" }),
    ).toHaveAttribute("href", eventSessionsHref(FINTECH_ID));
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows the server's message with a way to try again for any other failure", async () => {
    const user = userEvent.setup();
    // The hook retries a failure twice before giving up, so every try fails until the click.
    api.get.mockRejectedValue(
      new ApiError(503, "UNAVAILABLE", "Try again in a moment"),
    );
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByText("We couldn't load this session"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again in a moment")).toBeInTheDocument();
    api.get.mockResolvedValue(session);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("navigation", { name: "Session steps" }),
    ).toBeInTheDocument();
  });

  it("is read-only for a cancelled session: no steps, no form", async () => {
    api.get.mockResolvedValue({ ...cancelledKeynote, eventId: FINTECH_ID });
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={cancelledKeynote.id} />,
    );

    expect(
      await screen.findByText("This session can no longer be edited"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A cancelled session is read-only."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Session steps" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save/ }),
    ).not.toBeInTheDocument();
  });

  it("is read-only when the event is cancelled", async () => {
    events.getOverview.mockResolvedValue(overviewOf(MEETUP_ID));
    renderWithClient(
      <EditSession eventId={MEETUP_ID} sessionId={session.id} />,
    );

    expect(
      await screen.findByText("This session can no longer be edited"),
    ).toBeInTheDocument();
    expect(screen.getByText("This event is cancelled.")).toBeInTheDocument();
  });
});

describe("EditSession: cancelling the session", () => {
  const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Cancel session" }));
    return within(screen.getByRole("dialog"));
  };

  it("offers Cancel session on every step", async () => {
    for (const step of ["details", "content", "cover"] as const) {
      const { unmount } = renderWithClient(
        <EditSession eventId={FINTECH_ID} sessionId={session.id} step={step} />,
      );
      expect(
        await screen.findByRole("button", { name: "Cancel session" }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("asks first, saying the hall is freed, and does nothing when the organizer keeps it", async () => {
    const user = userEvent.setup();
    await renderStep("details");

    const dialog = await openDialog(user);
    expect(dialog.getByText("Cancel this session?")).toBeInTheDocument();
    expect(
      dialog.getByText(/Hall A is free for another session/),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Keep session" }));

    expect(api.cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancels the session, then leaves for the sessions list where it shows as cancelled", async () => {
    const user = userEvent.setup();
    api.cancel.mockResolvedValue({ ...session, status: "cancelled" });
    await renderStep("details");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Cancel session" }));

    await waitFor(() =>
      expect(api.cancel).toHaveBeenCalledWith(FINTECH_ID, session.id),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(eventSessionsHref(FINTECH_ID)),
    );
  });

  it("keeps the dialog open and shows why when it cannot be cancelled", async () => {
    const user = userEvent.setup();
    api.cancel.mockRejectedValue(
      new ApiError(
        409,
        "SESSION_ENDED",
        "A session that has ended cannot be cancelled",
      ),
    );
    await renderStep("details");

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole("button", { name: "Cancel session" }));

    expect(
      await screen.findByText("We couldn't cancel the session"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A session that has ended cannot be cancelled"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("is not offered for a session that is already cancelled", async () => {
    api.get.mockResolvedValue({ ...cancelledKeynote, eventId: FINTECH_ID });
    renderWithClient(
      <EditSession eventId={FINTECH_ID} sessionId={cancelledKeynote.id} />,
    );

    await screen.findByText("This session can no longer be edited");
    expect(
      screen.queryByRole("button", { name: "Cancel session" }),
    ).not.toBeInTheDocument();
  });
});

describe("EditSession: the details step", () => {
  it("shows the saved session in the form, with the date and times in the event's zone", async () => {
    await renderStep("details");

    expect(screen.getByLabelText("Session title")).toHaveValue(session.title);
    expect(screen.getByLabelText("Date")).toHaveValue("2026-12-12");
    expect(screen.getByLabelText("Start time")).toHaveValue("10:00");
    expect(screen.getByLabelText("End time")).toHaveValue("11:00");
  });

  it("says which hall the session has booked, and when", async () => {
    await renderStep("details");

    const booking = within(screen.getByRole("region", { name: "Booking" }));
    expect(booking.getByText("You have booked Hall A")).toBeInTheDocument();
    expect(
      booking.getByText("Sat 12 Dec 2026, 10:00 – 11:00 IST"),
    ).toBeInTheDocument();
  });

  it("says there is no hall for an online session", async () => {
    api.get.mockResolvedValue({
      ...session,
      mode: "online",
      hallId: null,
      hallName: null,
      onlineUrl: "https://meet.example.com/x",
    });
    await renderStep("details");

    const booking = within(screen.getByRole("region", { name: "Booking" }));
    expect(
      booking.getByText("This session has no hall booked (it is online)."),
    ).toBeInTheDocument();
    expect(booking.queryByText(/You have booked/)).not.toBeInTheDocument();
  });

  it("asks which halls are free without this session's own booking, so its hall is not shown as taken", async () => {
    await renderStep("details");

    await waitFor(() => expect(venues.getHallAvailability).toHaveBeenCalled());
    expect(venues.getHallAvailability).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        startAt: "2026-12-12T10:00:00+05:30",
        endAt: "2026-12-12T11:00:00+05:30",
        exceptSessionId: session.id,
      }),
    );
  });

  it("marks the session's own hall 'Booked by this session' in the hall list", async () => {
    const user = userEvent.setup();
    await renderStep("details");

    await user.click(await screen.findByRole("combobox", { name: "Hall" }));

    expect(
      await screen.findByRole("option", {
        name: /Hall A.*Booked by this session/,
      }),
    ).toBeInTheDocument();
    // Another hall is just described by its seats.
    expect(
      screen.getByRole("option", { name: /Hall B.*120 seats/ }),
    ).toBeInTheDocument();
  });

  it("moves the session: sends the new time with the zone, then opens the content step", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(session);
    await renderStep("details");

    fireEvent.change(screen.getByLabelText("Start time"), {
      target: { value: "14:00" },
    });
    fireEvent.change(screen.getByLabelText("End time"), {
      target: { value: "15:30" },
    });
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update).toHaveBeenCalledWith(
      FINTECH_ID,
      session.id,
      expect.objectContaining({
        hallId: HALL_A_ID,
        startAt: "2026-12-12T14:00:00+05:30",
        endAt: "2026-12-12T15:30:00+05:30",
      }),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        eventSessionEditHref(FINTECH_ID, session.id, "content"),
      ),
    );
    // The speakers were not touched, so only the details were sent.
    expect(api.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("shows why the server refused (a busy hall) and stays on the step", async () => {
    const user = userEvent.setup();
    api.update.mockRejectedValue(
      new ApiError(409, "HALL_BUSY", "Hall A is busy 11:30–12:15"),
    );
    await renderStep("details");

    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText("We couldn't save this session"),
    ).toBeInTheDocument();
    expect(screen.getByText("Hall A is busy 11:30–12:15")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not send a session whose end is before its start", async () => {
    const user = userEvent.setup();
    await renderStep("details");

    fireEvent.change(screen.getByLabelText("End time"), {
      target: { value: "09:00" },
    });
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(api.update).not.toHaveBeenCalled();
  });
});

/** Adds a speaker from the picker's searchable list. */
async function addSpeaker(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    await screen.findByRole("combobox", { name: "Add a speaker" }),
  );
  await user.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
  );
}

describe("EditSession: the speakers, inside the details step", () => {
  it("lists who presents on the details step, with no separate step", async () => {
    await renderStep("details");

    const list = await screen.findByRole("list", {
      name: "Speakers of this session",
    });
    expect(within(list).getByText("Ananya Rao")).toBeInTheDocument();
    expect(
      screen.getByText("Speakers", { selector: "h2" }),
    ).toBeInTheDocument();
  });

  it("saves the details, then the whole speaker list when it changed, then opens the content step", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(session);
    api.replaceSpeakers.mockResolvedValue(session);
    await renderStep("details");

    await addSpeaker(user, "Meera Joshi");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() =>
      expect(api.replaceSpeakers).toHaveBeenCalledWith(FINTECH_ID, session.id, {
        speakers: [
          { speakerId: SPEAKER_ANANYA_ID, role: "speaker" },
          { speakerId: meera.id, role: "speaker" },
        ],
      }),
    );
    expect(api.update).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        eventSessionEditHref(FINTECH_ID, session.id, "content"),
      ),
    );
  });

  it("will not save a session with no speaker, and calls no API", async () => {
    const user = userEvent.setup();
    await renderStep("details");

    await user.click(
      await screen.findByRole("button", { name: "Remove Ananya Rao" }),
    );
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText("Add at least one speaker"),
    ).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.replaceSpeakers).not.toHaveBeenCalled();
  });

  it("says the details were saved when the speakers were refused (a busy speaker)", async () => {
    const user = userEvent.setup();
    api.update.mockResolvedValue(session);
    api.replaceSpeakers.mockRejectedValue(
      new ApiError(
        409,
        "SPEAKER_BUSY",
        "Ananya Rao is on another session then",
      ),
    );
    await renderStep("details");

    await addSpeaker(user, "Meera Joshi");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText(
        "The details were saved, but we couldn't save the speakers",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ananya Rao is on another session then"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("EditSession: the content step", () => {
  it("shows the saved description, prerequisites and links", async () => {
    await renderStep("content");

    expect(await screen.findByLabelText("Description")).toHaveValue(
      "How to build apps that work offline.",
    );
    expect(screen.getByLabelText("Prerequisites")).toHaveValue(
      "Basic TypeScript",
    );
    expect(screen.getByLabelText("Link 1 label")).toHaveValue("Slides");
    expect(screen.getByLabelText("Link 1 address")).toHaveValue(
      "https://example.com/slides",
    );
  });

  it("shows a skeleton while the content loads", async () => {
    api.getContent.mockReturnValue(new Promise(() => {}));
    await renderStep("content");

    expect(
      screen.getByRole("status", { name: "Loading content" }),
    ).toBeInTheDocument();
  });

  it("saves every field, then opens the cover step", async () => {
    const user = userEvent.setup();
    api.updateContent.mockResolvedValue(content());
    await renderStep("content");

    const description = await screen.findByLabelText("Description");
    await user.clear(description);
    await user.type(description, "New description");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() =>
      expect(api.updateContent).toHaveBeenCalledWith(FINTECH_ID, session.id, {
        description: "New description",
        prerequisites: "Basic TypeScript",
        resources: [{ label: "Slides", url: "https://example.com/slides" }],
      }),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        eventSessionEditHref(FINTECH_ID, session.id, "cover"),
      ),
    );
  });

  it("adds and removes links", async () => {
    const user = userEvent.setup();
    await renderStep("content");

    await user.click(await screen.findByRole("button", { name: "Add link" }));
    expect(screen.getByLabelText("Link 2 label")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove link 1" }));
    expect(screen.queryByLabelText("Link 2 label")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Link 1 label")).toHaveValue("");
  });

  it("refuses a link that is not https, and does not call the API", async () => {
    const user = userEvent.setup();
    await renderStep("content");

    const address = await screen.findByLabelText("Link 1 address");
    await user.clear(address);
    await user.type(address, "http://example.com");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText("Use a link that starts with https://"),
    ).toBeInTheDocument();
    expect(api.updateContent).not.toHaveBeenCalled();
  });

  it("can be skipped without saving", async () => {
    const user = userEvent.setup();
    await renderStep("content");

    await user.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );

    expect(api.updateContent).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(
      eventSessionEditHref(FINTECH_ID, session.id, "cover"),
    );
  });

  it("shows the server's message when saving fails", async () => {
    const user = userEvent.setup();
    api.updateContent.mockRejectedValue(
      new ApiError(
        503,
        "CMS_UNAVAILABLE",
        "The content is not available right now",
      ),
    );
    await renderStep("content");

    await user.click(
      await screen.findByRole("button", { name: "Save & continue" }),
    );

    expect(
      await screen.findByText("We couldn't save the content"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The content is not available right now"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("says when the content could not be loaded, and offers to try again or skip", async () => {
    const user = userEvent.setup();
    // The hook retries a failure twice before giving up, so every try fails until the click.
    api.getContent.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "The CMS is down"),
    );
    await renderStep("content");

    expect(
      await screen.findByText("We couldn't load the content"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skip for now" }),
    ).toBeInTheDocument();
    api.getContent.mockResolvedValue(content());
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Description")).toBeInTheDocument();
  });
});

describe("EditSession: the cover step", () => {
  const png = (size = 2048, type = "image/png") =>
    new File([new Uint8Array(size)], "cover.png", { type });

  it("says there is no cover yet, and that it is optional", async () => {
    await renderStep("cover");

    expect(await screen.findByText(/No cover image yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Upload cover" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove cover" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Finish" })).toHaveAttribute(
      "href",
      eventSessionsHref(FINTECH_ID),
    );
  });

  it("shows the saved cover with a way to replace or remove it", async () => {
    api.getContent.mockResolvedValue(
      content({
        coverImage: {
          id: 7,
          url: "https://cms.example.com/cover.jpg",
          alt: "On stage",
          width: 1600,
          height: 600,
        },
      }),
    );
    await renderStep("cover");

    expect(
      await screen.findByRole("img", { name: "On stage" }),
    ).toHaveAttribute("src", "https://cms.example.com/cover.jpg");
    expect(
      screen.getByRole("button", { name: "Replace cover" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove cover" }),
    ).toBeInTheDocument();
  });

  it("uploads the chosen image", async () => {
    const user = userEvent.setup();
    api.uploadCover.mockResolvedValue({ coverImage: null });
    await renderStep("cover");

    const file = png();
    await user.upload(await screen.findByLabelText("Upload cover"), file);

    await waitFor(() =>
      expect(api.uploadCover).toHaveBeenCalledWith(
        FINTECH_ID,
        session.id,
        file,
      ),
    );
  });

  it("refuses an image of the wrong type before sending anything", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderStep("cover");

    await user.upload(
      await screen.findByLabelText("Upload cover"),
      png(2048, "image/gif"),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG or WebP image.",
    );
    expect(api.uploadCover).not.toHaveBeenCalled();
  });

  it("refuses an image that is too big before sending anything", async () => {
    const user = userEvent.setup();
    await renderStep("cover");

    await user.upload(
      await screen.findByLabelText("Upload cover"),
      png(4 * 1024 * 1024 + 1),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The image must be 4 MB or smaller.",
    );
    expect(api.uploadCover).not.toHaveBeenCalled();
  });

  it("shows the server's message when the upload fails", async () => {
    const user = userEvent.setup();
    api.uploadCover.mockRejectedValue(
      new ApiError(
        400,
        "VALIDATION_ERROR",
        "The image must be one JPEG, PNG or WebP file",
      ),
    );
    await renderStep("cover");

    await user.upload(await screen.findByLabelText("Upload cover"), png());

    expect(
      await screen.findByText("The cover image could not be saved"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The image must be one JPEG, PNG or WebP file"),
    ).toBeInTheDocument();
  });

  it("removes the cover", async () => {
    const user = userEvent.setup();
    api.deleteCover.mockResolvedValue(undefined);
    api.getContent.mockResolvedValue(
      content({
        coverImage: {
          id: 7,
          url: "https://cms.example.com/cover.jpg",
          alt: null,
          width: null,
          height: null,
        },
      }),
    );
    await renderStep("cover");

    await user.click(
      await screen.findByRole("button", { name: "Remove cover" }),
    );

    await waitFor(() =>
      expect(api.deleteCover).toHaveBeenCalledWith(FINTECH_ID, session.id),
    );
  });

  it("keeps Finish switched off while an image is uploading", async () => {
    const user = userEvent.setup();
    api.uploadCover.mockReturnValue(new Promise(() => {}));
    await renderStep("cover");

    await user.upload(await screen.findByLabelText("Upload cover"), png());

    const finish = await screen.findByRole("button", { name: "Finish" });
    expect(finish).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Finish" }),
    ).not.toBeInTheDocument();
  });
});
