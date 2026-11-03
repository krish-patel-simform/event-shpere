/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FINTECH_ID,
  findSampleOverview,
  FUTURES_ID,
  MEETUP_ID,
  SAMPLE_STATES,
  SAMPLE_VENUES,
} from "../../__fixtures__/event-manage";
import { renderWithClient, venueListFor } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { eventEditHref, eventHref, EVENT_ROUTES } from "../../routes";
import type { EventDto } from "../../schemas/events.schemas";
import { EventFormPage } from "../EventFormPage";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    listMine: jest.fn(),
    countMine: jest.fn(),
    getOverview: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getContent: jest.fn(),
    updateContent: jest.fn(),
    uploadCover: jest.fn(),
    deleteCover: jest.fn(),
    addGalleryImage: jest.fn(),
    deleteGalleryImage: jest.fn(),
  },
}));
jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { list: jest.fn(), getHallAvailability: jest.fn() },
}));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const api = jest.mocked(eventApiService);
const statesApi = jest.mocked(stateApiService);
const venuesApi = jest.mocked(venueApiService);

const newEventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";

const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const overviewOf = (id: string) => {
  const overview = findSampleOverview(id);
  if (!overview) throw new Error(`no sample overview ${id}`);
  return overview;
};

/** What the API answers for a saved event. */
const savedEvent = (overrides: Partial<EventDto> = {}): EventDto => ({
  id: newEventId,
  slug: "tech-conf",
  title: "Tech Conf",
  status: "draft",
  startAt: "2026-12-12T04:00:00.000Z",
  endAt: "2026-12-12T12:00:00.000Z",
  timezone: "Asia/Kolkata",
  venueId: null,
  capacity: null,
  ticketPrice: 0,
  currency: "INR",
  registrationOpensAt: null,
  registrationClosesAt: null,
  publishedAt: null,
  createdAt: "2026-11-02T10:00:00.000Z",
  ...overrides,
});

const stateSelect = () => screen.getByRole("combobox", { name: "State" });
const venueSelect = () => screen.getByRole("combobox", { name: "Venue" });
const statesLoaded = () => waitFor(() => expect(stateSelect()).toBeEnabled());

function setValue(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue([...SAMPLE_STATES]);
  venuesApi.list.mockImplementation(async ({ state }) =>
    venueListFor(state ?? ""),
  );
});

describe("EventFormPage: creating", () => {
  it("shows a Create event heading, a breadcrumb and the empty form", async () => {
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    expect(
      screen.getByRole("heading", { name: "Create event", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My events" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.list,
    );
    expect(screen.getByText("New event")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByLabelText("Event title")).toHaveValue("");
  });

  it("sends the event to the API as the body it takes, then opens the content step", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    api.create.mockResolvedValue(savedEvent());
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    setValue("Start date", start);
    setValue("End date", start);
    await user.type(screen.getByLabelText(/Event capacity/), "250");
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    // Replaced, not pushed: Back must not return to an empty "new event" form.
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        eventEditHref(newEventId, "content"),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledWith({
      title: "Tech Conf",
      startAt: `${start}T09:00:00+05:30`,
      endAt: `${start}T17:00:00+05:30`,
      timezone: "Asia/Kolkata",
      capacity: 250,
      ticketPrice: 0,
    });
  });

  it("sends the chosen venue and a price in paise", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    api.create.mockResolvedValue(savedEvent());
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    setValue("Start date", start);
    setValue("End date", start);
    await user.click(stateSelect());
    await user.click(
      await screen.findByRole("option", { name: /^Maharashtra/ }),
    );
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());
    await user.click(
      await screen.findByRole("option", { name: /^Hotel Orchid/ }),
    );
    await user.clear(screen.getByLabelText("Ticket price (₹)"));
    await user.type(screen.getByLabelText("Ticket price (₹)"), "499.50");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        venueId: SAMPLE_VENUES[2].id,
        ticketPrice: 49950,
      }),
    );
  });

  it("sends nothing when the form is not valid", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(
      await screen.findByText("Title must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("waits while the event is being created", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    api.create.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    setValue("Start date", start);
    setValue("End date", start);
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(
      await screen.findByRole("button", { name: "Creating event…" }),
    ).toBeDisabled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the event could not be created, and stays", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    api.create.mockRejectedValue(
      new ApiError(
        503,
        "CMS_UNAVAILABLE",
        "Could not create the event right now. Please try again.",
      ),
    );
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    setValue("Start date", start);
    setValue("End date", start);
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not create the event right now. Please try again.",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // The organizer's input is still there to try again.
    expect(screen.getByLabelText("Event title")).toHaveValue("Tech Conf");
  });

  it("explains an organizer who is not approved yet", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    api.create.mockRejectedValue(
      new ApiError(
        403,
        "ORGANIZER_NOT_VERIFIED",
        "Your organizer account is waiting for admin approval",
      ),
    );
    renderWithClient(<EventFormPage />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    setValue("Start date", start);
    setValue("End date", start);
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your organizer account is waiting for admin approval",
    );
  });
});

describe("EventFormPage: editing", () => {
  it("shows a skeleton while the event loads, then the form", async () => {
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Event title")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Event title")).toHaveValue(
      "Fintech Product Forum",
    );
    expect(api.getOverview).toHaveBeenCalledWith(FINTECH_ID);
  });

  it("names the event in the heading and the breadcrumb", async () => {
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    expect(
      screen.getByRole("heading", { name: "Edit event", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Fintech Product Forum" }),
    ).toHaveAttribute("href", eventHref(FINTECH_ID));
  });

  it("shows the three steps as links, on Details, with Content and Media still to do", async () => {
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    const steps = screen.getByRole("navigation", { name: "Event steps" });
    expect(
      within(steps).getByRole("link", { name: /^Details/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      within(steps).getByRole("link", { name: /^Content/ }),
    ).toHaveAttribute("href", eventEditHref(FINTECH_ID, "content"));
    expect(within(steps).getByRole("link", { name: /^Media/ })).toHaveAttribute(
      "href",
      eventEditHref(FINTECH_ID, "media"),
    );
    // The sample event has no description and no banner yet.
    expect(
      within(steps).queryByText("(done)", { exact: false }),
    ).toBeInTheDocument();
    expect(within(steps).getAllByText("(done)", { exact: false })).toHaveLength(
      1,
    );
  });

  it("ticks Content and Media when the page has a description and a banner", async () => {
    api.getOverview.mockResolvedValue({
      ...overviewOf(FINTECH_ID),
      content: { hasDescription: true, hasBanner: true },
    });
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    const steps = screen.getByRole("navigation", { name: "Event steps" });
    expect(within(steps).getAllByText("(done)", { exact: false })).toHaveLength(
      3,
    );
  });

  it("leaves Content and Media unticked when the CMS did not answer", async () => {
    api.getOverview.mockResolvedValue({
      ...overviewOf(FINTECH_ID),
      content: null,
    });
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    const steps = screen.getByRole("navigation", { name: "Event steps" });
    expect(within(steps).getAllByText("(done)", { exact: false })).toHaveLength(
      1,
    );
  });

  it("sends every field the form edits, then opens the content step", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(60);
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    api.update.mockResolvedValue(savedEvent({ id: FINTECH_ID }));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    await user.clear(screen.getByLabelText("Event title"));
    await user.type(screen.getByLabelText("Event title"), "Fintech Forum 2027");
    setValue("Start date", start);
    setValue("End date", start);
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        eventEditHref(FINTECH_ID, "content"),
      ),
    );
    expect(api.update).toHaveBeenCalledWith(FINTECH_ID, {
      title: "Fintech Forum 2027",
      startAt: `${start}T09:30:00+05:30`,
      endAt: `${start}T17:30:00+05:30`,
      venueId: SAMPLE_VENUES[2].id,
      capacity: 250,
      ticketPrice: 0,
    });
  });

  it("sends null to clear the venue and the limit", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(60);
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    api.update.mockResolvedValue(savedEvent({ id: FINTECH_ID }));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    setValue("Start date", start);
    setValue("End date", start);
    await user.clear(screen.getByLabelText(/Event capacity/));
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());
    await user.click(
      await screen.findByRole("option", { name: "Choose a venue later" }),
    );
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update).toHaveBeenCalledWith(
      FINTECH_ID,
      expect.objectContaining({ venueId: null, capacity: null }),
    );
  });

  it("shows the server's reason when a change is not allowed, and stays", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(60);
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    api.update.mockRejectedValue(
      new ApiError(
        409,
        "EVENT_HAS_REGISTRATIONS",
        "The venue can't change once people have registered",
      ),
    );
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    setValue("Start date", start);
    setValue("End date", start);
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The venue can't change once people have registered",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't save your changes",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("says Saving… while the save runs", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(60);
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    api.update.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);
    await screen.findByLabelText("Event title");

    setValue("Start date", start);
    setValue("End date", start);
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
  });

  it("says so for an event that is not the organizer's (404), without retrying", async () => {
    api.getOverview.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Event not found"),
    );
    renderWithClient(
      <EventFormPage eventId="00000000-0000-4000-8000-000000000000" />,
    );

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to My events" }),
    ).toHaveAttribute("href", EVENT_ROUTES.list);
    expect(screen.queryByLabelText("Event title")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(api.getOverview).toHaveBeenCalledTimes(1);
  });

  it("says when the event could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    // A transient error is retried twice by the hook before it is shown.
    api.getOverview.mockRejectedValue(
      new ApiError(500, "UNKNOWN", "Something went wrong"),
    );
    renderWithClient(<EventFormPage eventId={FINTECH_ID} />);

    expect(
      await screen.findByText("We couldn't load this event"),
    ).toBeInTheDocument();
    expect(api.getOverview).toHaveBeenCalledTimes(3);
    api.getOverview.mockResolvedValue(overviewOf(FINTECH_ID));
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Event title")).toBeInTheDocument();
  });

  it("does not offer a form for a cancelled event", async () => {
    api.getOverview.mockResolvedValue(overviewOf(MEETUP_ID));
    renderWithClient(<EventFormPage eventId={MEETUP_ID} />);

    expect(
      await screen.findByText("This event is cancelled"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Event title")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the overview" }),
    ).toHaveAttribute("href", eventHref(MEETUP_ID));
  });

  it("does not offer a form for a completed event", async () => {
    api.getOverview.mockResolvedValue(overviewOf(FUTURES_ID));
    renderWithClient(<EventFormPage eventId={FUTURES_ID} />);

    expect(await screen.findByText("This event has ended")).toBeInTheDocument();
    expect(screen.queryByLabelText("Event title")).not.toBeInTheDocument();
  });
});
