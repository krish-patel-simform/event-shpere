/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import { speakersApiService } from "@/src/features/speakers/api/speakers-api.service";
import {
  findSampleOverview,
  MEETUP_ID,
  SUMMIT_ID,
} from "../../../events/__fixtures__/event-manage";
import { eventApiService } from "../../../events/api/event-api.service";
import { eventEditHref, eventSessionsHref } from "../../../events";
import { ananya, meera } from "../../../speakers/__fixtures__/speakers";
import { sessionApiService } from "../../api/session-api.service";
import { eventSessionEditHref } from "../../routes";
import {
  HALL_A_ID,
  HALL_B_ID,
  talk,
} from "../../__fixtures__/organizer-sessions";
import { renderWithClient } from "../../__fixtures__/render";
import { AddSession } from "../AddSession";

jest.mock("../../../events/api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
jest.mock("../../api/session-api.service", () => ({
  sessionApiService: { create: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { getHallAvailability: jest.fn() },
}));
jest.mock("@/src/features/speakers/api/speakers-api.service", () => ({
  speakersApiService: { list: jest.fn() },
}));
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const events = jest.mocked(eventApiService);
const api = jest.mocked(sessionApiService);
const venues = jest.mocked(venueApiService);
const speakers = jest.mocked(speakersApiService);

type User = ReturnType<typeof userEvent.setup>;

function overviewOf(id: string) {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
}

const halls = (busy: readonly string[] = []) =>
  [
    { id: HALL_A_ID, name: "Hall A", capacity: 300 },
    { id: HALL_B_ID, name: "Hall B", capacity: 120 },
  ].map((hall) => ({
    ...hall,
    busy: busy.includes(hall.id),
    bookedSlots: busy.includes(hall.id)
      ? [
          {
            startAt: "2026-12-04T04:30:00.000Z",
            endAt: "2026-12-04T05:30:00.000Z",
          },
        ]
      : [],
  }));

/** Shows the form of an event, once its heading has loaded. */
async function renderPage(overview = overviewOf(SUMMIT_ID)) {
  events.getOverview.mockResolvedValue(overview);
  renderWithClient(<AddSession eventId={overview.event.id} />);
  await screen.findByRole("heading", { level: 1, name: "Add session" });
}

/** Opens a searchable list and clicks the row whose name starts with `name`. */
async function pick(user: User, field: HTMLElement, name: string) {
  await user.click(field);
  await user.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
  );
}

const setValue = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** Fills the form of an in-person session in Hall A with Ananya, ready to submit. */
async function fillInPersonSession(user: User) {
  await user.type(screen.getByLabelText("Session title"), "Offline-first Apps");
  await user.selectOptions(screen.getByLabelText("Type"), "talk");
  setValue("Date", "2026-12-04");
  setValue("Start time", "10:00");
  setValue("End time", "11:00");
  await pick(
    user,
    await screen.findByRole("combobox", { name: "Hall" }),
    "Hall A",
  );
  await pick(
    user,
    await screen.findByRole("combobox", { name: "Add a speaker" }),
    "Ananya Rao",
  );
  await user.type(screen.getByLabelText("Extra price (₹)"), "0");
}

const submit = (user: User) =>
  user.click(screen.getByRole("button", { name: "Add session" }));

beforeEach(() => {
  jest.resetAllMocks();
  venues.getHallAvailability.mockResolvedValue(halls());
  speakers.list.mockResolvedValue({
    items: [ananya, meera],
    meta: { page: 1, pageSize: 50, total: 2 },
  });
});

describe("AddSession: the steps", () => {
  it("shows the same steps as editing, with the content and the cover locked until the session is added", async () => {
    await renderPage();

    const steps = within(
      screen.getByRole("navigation", { name: "Session steps" }),
    );
    expect(steps.getAllByRole("listitem")).toHaveLength(3);
    expect(
      steps.getByText("Details").closest("[aria-current]"),
    ).toHaveAttribute("aria-current", "step");
    for (const label of ["Content", "Cover"]) {
      expect(steps.getByText(label).closest("[aria-disabled]")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });

  it("has no Speakers step: the speakers card is part of the details form", async () => {
    await renderPage();

    expect(
      within(
        screen.getByRole("navigation", { name: "Session steps" }),
      ).queryByText("Speakers"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Speakers" }),
    ).toBeInTheDocument();
  });

  it("says the content comes next, and shows no steps for an event that cannot change", async () => {
    await renderPage();
    expect(
      screen.getByText(/the next step is the content/),
    ).toBeInTheDocument();
  });

  it("has no steps when the event is cancelled: nothing can be added", async () => {
    await renderPage(overviewOf(MEETUP_ID));

    expect(
      screen.queryByRole("navigation", { name: "Session steps" }),
    ).not.toBeInTheDocument();
  });
});

describe("AddSession: the page", () => {
  it("shows a skeleton while the event loads", () => {
    events.getOverview.mockReturnValue(new Promise(() => {}));
    renderWithClient(<AddSession eventId={SUMMIT_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
  });

  it("says where you are, with the way back to the list", async () => {
    await renderPage();

    const trail = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(trail.getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "href",
      eventSessionsHref(SUMMIT_ID),
    );
    expect(trail.getByText("New session")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      eventSessionsHref(SUMMIT_ID),
    );
  });

  it("starts on the first day of the event, 09:00 to 10:00, in the event's zone", async () => {
    await renderPage();

    expect(screen.getByLabelText("Date")).toHaveValue("2026-12-03");
    expect(screen.getByLabelText("Date")).toHaveAttribute("min", "2026-12-03");
    expect(screen.getByLabelText("Date")).toHaveAttribute("max", "2026-12-05");
    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("End time")).toHaveValue("10:00");
    expect(screen.getByText(/Times are in IST/)).toBeInTheDocument();
  });

  it("is read-only for an event that is cancelled: no form, a way back", async () => {
    events.getOverview.mockResolvedValue(overviewOf(MEETUP_ID));
    renderWithClient(<AddSession eventId={MEETUP_ID} />);

    expect(
      await screen.findByText("Sessions are read-only"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Session title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sessions" }),
    ).toHaveAttribute("href", eventSessionsHref(MEETUP_ID));
  });
});

describe("AddSession: validating", () => {
  it("says what is missing, and does not save", async () => {
    const user = userEvent.setup();
    await renderPage();

    await submit(user);

    expect(
      await screen.findByText("Title must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Choose a session type")).toBeInTheDocument();
    expect(screen.getByText("Choose a hall")).toBeInTheDocument();
    expect(screen.getByText("Add at least one speaker")).toBeInTheDocument();
    expect(
      screen.getByText(/Enter an amount like 0 or 499.50/),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("wants the end after the start", async () => {
    const user = userEvent.setup();
    await renderPage();
    setValue("End time", "09:00");

    await submit(user);

    expect(
      await screen.findByText("End must be after the start"),
    ).toBeInTheDocument();
  });

  it("does not accept a speaker list of only moderators", async () => {
    const user = userEvent.setup();
    await renderPage();
    await pick(
      user,
      await screen.findByRole("combobox", { name: "Add a speaker" }),
      "Ananya Rao",
    );
    await user.selectOptions(
      screen.getByLabelText("Role of Ananya Rao"),
      "moderator",
    );

    await submit(user);

    expect(
      await screen.findByText("Add at least one speaker (not only moderators)"),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe("AddSession: saving", () => {
  it("sends the session with its hall and speakers, then goes back to the list", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(talk);
    await renderPage();
    await fillInPersonSession(user);

    await submit(user);

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith(SUMMIT_ID, {
      title: "Offline-first Apps",
      type: "talk",
      mode: "in_person",
      hallId: HALL_A_ID,
      startAt: "2026-12-04T10:00:00+05:30",
      endAt: "2026-12-04T11:00:00+05:30",
      requiresRegistration: false,
      price: 0,
      speakers: [{ speakerId: ananya.id, role: "speaker" }],
    });
    // On to the new session's Content step (not back to the list).
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        eventSessionEditHref(SUMMIT_ID, talk.id, "content"),
      ),
    );
  });

  it("sends the price in paise and the registration choice", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(talk);
    await renderPage();
    await fillInPersonSession(user);
    await user.clear(screen.getByLabelText("Extra price (₹)"));
    await user.type(screen.getByLabelText("Extra price (₹)"), "499.50");
    await user.click(screen.getByLabelText(/Attendees must book a seat/));

    await submit(user);

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      price: 49950,
      requiresRegistration: true,
    });
  });

  it("shows the progress, and blocks a second save while it runs", async () => {
    const user = userEvent.setup();
    api.create.mockReturnValue(new Promise(() => {}));
    await renderPage();
    await fillInPersonSession(user);

    await submit(user);

    const saving = await screen.findByRole("button", {
      name: "Adding session…",
    });
    expect(saving).toBeDisabled();
    expect(screen.getByLabelText("Session title")).toHaveAttribute("readonly");
  });

  it("shows why the server refused, keeps what was typed, and does not leave", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(
      new ApiError(
        409,
        "HALL_BUSY",
        "This hall is already booked at that time",
      ),
    );
    await renderPage();
    await fillInPersonSession(user);

    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't add this session",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This hall is already booked at that time",
    );
    expect(screen.getByLabelText("Session title")).toHaveValue(
      "Offline-first Apps",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("AddSession: how it is attended", () => {
  it("takes a join link and no hall for an online session", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(talk);
    await renderPage();
    await user.type(screen.getByLabelText("Session title"), "Remote Talk");
    await user.selectOptions(screen.getByLabelText("Type"), "talk");
    await user.selectOptions(
      screen.getByLabelText("How it is attended"),
      "online",
    );

    expect(
      screen.queryByRole("combobox", { name: "Hall" }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Join link"),
      "https://meet.example.com/abc",
    );
    await pick(
      user,
      await screen.findByRole("combobox", { name: "Add a speaker" }),
      "Ananya Rao",
    );
    await user.type(screen.getByLabelText("Extra price (₹)"), "0");
    await submit(user);

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    const body = api.create.mock.calls[0]?.[1];
    expect(body).toMatchObject({
      mode: "online",
      onlineUrl: "https://meet.example.com/abc",
    });
    expect(body).not.toHaveProperty("hallId");
  });

  it("asks for a link that starts with https://", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.selectOptions(
      screen.getByLabelText("How it is attended"),
      "online",
    );
    await user.type(
      screen.getByLabelText("Join link"),
      "http://meet.example.com/abc",
    );

    await submit(user);

    expect(
      await screen.findByText("Use a link that starts with https://"),
    ).toBeInTheDocument();
  });

  it("needs both a hall and a link for a hybrid session", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.selectOptions(
      screen.getByLabelText("How it is attended"),
      "hybrid",
    );

    expect(
      await screen.findByRole("combobox", { name: "Hall" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Join link")).toBeInTheDocument();
  });

  it("forgets a hall that no longer fits when the session becomes online", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(talk);
    await renderPage();
    await fillInPersonSession(user);
    await user.selectOptions(
      screen.getByLabelText("How it is attended"),
      "online",
    );
    await user.type(
      screen.getByLabelText("Join link"),
      "https://meet.example.com/abc",
    );

    await submit(user);

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[1]).not.toHaveProperty("hallId");
  });
});

describe("AddSession: the hall", () => {
  it("asks which halls of the event's venue are available for the slot", async () => {
    const user = userEvent.setup();
    await renderPage();
    setValue("Date", "2026-12-04");
    setValue("Start time", "10:00");
    setValue("End time", "11:00");

    await user.click(await screen.findByRole("combobox", { name: "Hall" }));

    await waitFor(() =>
      expect(venues.getHallAvailability).toHaveBeenLastCalledWith(
        overviewOf(SUMMIT_ID).event.venue?.id,
        {
          startAt: "2026-12-04T10:00:00+05:30",
          endAt: "2026-12-04T11:00:00+05:30",
        },
      ),
    );
  });

  it("offers only the halls that are available, and still lists the booked one", async () => {
    const user = userEvent.setup();
    venues.getHallAvailability.mockResolvedValue(halls([HALL_B_ID]));
    await renderPage();

    await user.click(await screen.findByRole("combobox", { name: "Hall" }));

    const options = within(await screen.findByRole("listbox")).getAllByRole(
      "option",
    );
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining("Hall A"),
    ]);
    // The list under the field says why Hall B is missing.
    expect(
      screen.getByRole("list", { name: "Hall B is booked" }),
    ).toBeInTheDocument();
  });

  it("is not offered until the date and times make a slot", async () => {
    await renderPage();
    setValue("Start time", "");

    const hall = await screen.findByRole("combobox", { name: "Hall" });
    expect(hall).toBeDisabled();
    expect(hall).toHaveAttribute(
      "placeholder",
      "Choose the date and times first",
    );
    // The venue's list below says the same, in words.
    expect(
      screen.getByText(/Choose the start and end dates to see which halls/),
    ).toBeInTheDocument();
  });

  it("says so when the event has no venue yet, and links to choosing one", async () => {
    const overview = overviewOf(SUMMIT_ID);
    await renderPage({
      ...overview,
      event: { ...overview.event, venue: null },
    });

    expect(screen.getByText("This event has no venue yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Choose a venue" }),
    ).toHaveAttribute("href", eventEditHref(SUMMIT_ID));
    expect(
      screen.queryByRole("combobox", { name: "Hall" }),
    ).not.toBeInTheDocument();
  });
});

describe("AddSession: the speakers", () => {
  it("lists each added speaker with a role and a way to remove them", async () => {
    const user = userEvent.setup();
    await renderPage();
    await pick(
      user,
      await screen.findByRole("combobox", { name: "Add a speaker" }),
      "Ananya Rao",
    );

    const list = within(
      screen.getByRole("list", { name: "Speakers of this session" }),
    );
    expect(list.getByText("Ananya Rao")).toBeInTheDocument();
    expect(list.getByLabelText("Role of Ananya Rao")).toHaveValue("speaker");

    await user.click(list.getByRole("button", { name: "Remove Ananya Rao" }));

    expect(screen.getByText("No speakers added yet.")).toBeInTheDocument();
  });

  it("does not offer a speaker who is already added", async () => {
    const user = userEvent.setup();
    await renderPage();
    await pick(
      user,
      await screen.findByRole("combobox", { name: "Add a speaker" }),
      "Ananya Rao",
    );

    await user.click(screen.getByRole("combobox", { name: "Add a speaker" }));

    const options = within(await screen.findByRole("listbox")).getAllByRole(
      "option",
    );
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Meera Joshi");
  });

  it("says when the list holds only part of the speakers", async () => {
    speakers.list.mockResolvedValue({
      items: [ananya, meera],
      meta: { page: 1, pageSize: 50, total: 120 },
    });
    await renderPage();

    expect(
      await screen.findByText("Showing the first 50 of 120 speakers."),
    ).toBeInTheDocument();
  });

  it("shows why the speakers did not load, and loads them again on Try again", async () => {
    const user = userEvent.setup();
    speakers.list.mockRejectedValue(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    await renderPage();

    expect(
      await screen.findByText("We couldn't load the speakers"),
    ).toBeInTheDocument();

    speakers.list.mockResolvedValue({
      items: [ananya],
      meta: { page: 1, pageSize: 50, total: 1 },
    });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("combobox", { name: "Add a speaker" }),
    ).toBeEnabled();
  });
});
