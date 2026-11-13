/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { venueApiService } from "@/src/features/venues/api/venue-api.service";
import {
  FINTECH_ID,
  SAMPLE_EVENTS,
  SAMPLE_STATES,
  SAMPLE_VENUES,
} from "../../__fixtures__/event-manage";
import { dayButtonName, setValue } from "../../__fixtures__/pickers";
import { renderWithClient, venueListFor } from "../../__fixtures__/render";
import { eventHref, EVENT_ROUTES } from "../../routes";
import type { ManagedEvent } from "../../types/event-manage.types";
import { eventDateLimits } from "../../utils/event-date-limits";
import { EventForm } from "../EventForm";

jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
jest.mock("@/src/features/venues/api/venue-api.service", () => ({
  venueApiService: { list: jest.fn(), getHallAvailability: jest.fn() },
}));
const statesApi = jest.mocked(stateApiService);
const venuesApi = jest.mocked(venueApiService);

const fintech = SAMPLE_EVENTS.find((event) => event.id === FINTECH_ID)!;

const dayFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/** By role: the "Venue" card heading also labels its section, so the label text matches twice. */
const venueSelect = () => screen.getByRole("combobox", { name: "Venue" });
const stateSelect = () => screen.getByRole("combobox", { name: "State" });

type User = ReturnType<typeof userEvent.setup>;

/** Opens a searchable list and clicks the row whose name starts with `name`. */
async function pick(user: User, field: HTMLElement, name: string) {
  await user.click(field);
  await user.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
  );
}

const optionNames = () =>
  screen.getAllByRole("option").map((option) => option.textContent);

/** The states arrive from the API: wait until the State select can be used. */
const statesLoaded = () => waitFor(() => expect(stateSelect()).toBeEnabled());

/** The values the form handed to onSubmit (react-hook-form also passes the DOM event). */
const submittedValues = (onSubmit: jest.Mock) => onSubmit.mock.calls[0][0];

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue([...SAMPLE_STATES]);
  venuesApi.list.mockImplementation(async ({ state }) =>
    venueListFor(state ?? ""),
  );
});

describe("EventForm: creating", () => {
  it("shows every section and a Create event button", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    for (const title of [
      "Basics",
      "Date and time",
      "Venue",
      "Tickets and capacity",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Create event" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.list,
    );
  });

  it("starts empty, nine to five, with 0 only as the price placeholder", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(screen.getByLabelText("Event title")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: /Start date/ }),
    ).toHaveTextContent("Select a date");
    expect(
      screen.getByRole("combobox", { name: /Start time/ }),
    ).toHaveTextContent("9:00 AM");
    expect(
      screen.getByRole("combobox", { name: /End time/ }),
    ).toHaveTextContent("5:00 PM");
    expect(screen.getByLabelText("Ticket price (₹)")).toHaveValue("");
    expect(screen.getByLabelText("Ticket price (₹)")).toHaveAttribute(
      "placeholder",
      "0",
    );
  });

  it("has no input for the public link: the server makes it", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(
      screen.queryByLabelText(/public link|slug/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("The public link is made from the title."),
    ).toBeInTheDocument();
  });

  it("is a draft", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows what is wrong, next to the fields, without calling onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    renderWithClient(<EventForm onSubmit={onSubmit} />);
    await statesLoaded();

    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(
      await screen.findByText("Title must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Start date is required")).toBeInTheDocument();
    expect(screen.getByText("End date is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Event title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an end before the start when the start is moved past the end", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    await setValue("Start date", dayFromNow(30));
    await setValue("End date", dayFromNow(30));
    // The end can not be chosen before the start, but the start can still be moved past it.
    await setValue("Start date", dayFromNow(31));
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(
      await screen.findByText("The event must end after it starts"),
    ).toBeInTheDocument();
  });

  describe("the date and time pickers", () => {
    const limits = eventDateLimits();
    const openStartDate = (user: User) =>
      user.click(screen.getByRole("button", { name: /^Start date/ }));

    it("offers no day before today", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await openStartDate(user);

      expect(
        screen.getByRole("button", { name: "Go to the Previous Month" }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("button", { name: dayButtonName(limits.min) }),
      ).toBeEnabled();
    });

    it("offers years from this one up to ten years ahead, and no further", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await openStartDate(user);

      const years = within(screen.getByRole("dialog")).getByRole("combobox", {
        name: "Choose the Year",
      });
      const names = within(years)
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(names[0]).toBe(limits.min.slice(0, 4));
      expect(names.at(-1)).toBe(limits.max.slice(0, 4));
    });

    it("offers no end day before the start day", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await setValue("Start date", dayFromNow(30));
      await user.click(screen.getByRole("button", { name: /^End date/ }));

      expect(
        screen.getByRole("button", { name: "Go to the Previous Month" }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("disables the times that have passed when the event starts today", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await setValue("Start date", limits.min);
      await user.click(screen.getByRole("combobox", { name: /^Start time/ }));

      expect(screen.getByRole("option", { name: "12:00 AM" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("allows any start time on a later day", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await setValue("Start date", dayFromNow(30));
      await user.click(screen.getByRole("combobox", { name: /^Start time/ }));

      expect(
        screen.getByRole("option", { name: "12:00 AM" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("disables end times that are not after the start time on the same day", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      // The start time is 9:00 AM until it is changed.
      await setValue("Start date", dayFromNow(30));
      await setValue("End date", dayFromNow(30));
      await user.click(screen.getByRole("combobox", { name: /^End time/ }));

      expect(screen.getByRole("option", { name: "9:00 AM" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(
        screen.getByRole("option", { name: "9:15 AM" }),
      ).not.toHaveAttribute("aria-disabled");
    });

    it("allows any end time when the event ends on a later day", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm onSubmit={jest.fn()} />);
      await statesLoaded();

      await setValue("Start date", dayFromNow(30));
      await setValue("End date", dayFromNow(31));
      await user.click(screen.getByRole("combobox", { name: /^End time/ }));

      expect(
        screen.getByRole("option", { name: "9:00 AM" }),
      ).not.toHaveAttribute("aria-disabled");
    });
  });

  it("makes capacity a number input that starts at 1 and counts in whole numbers", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    const capacity = screen.getByLabelText(/Event capacity/);
    expect(capacity).toHaveAttribute("type", "number");
    expect(capacity).toHaveAttribute("min", "1");
    expect(capacity).toHaveAttribute("step", "1");
  });

  it("does not let a decimal point, a sign or an exponent be typed into capacity", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.type(screen.getByLabelText(/Event capacity/), "1e+-.5");

    // Only the digits got in.
    expect(screen.getByLabelText(/Event capacity/)).toHaveValue(15);
  });

  it("rejects a bad capacity and price", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    await setValue("Start date", dayFromNow(30));
    await setValue("End date", dayFromNow(30));
    await user.type(screen.getByLabelText(/Event capacity/), "0");
    await user.clear(screen.getByLabelText("Ticket price (₹)"));
    await user.type(screen.getByLabelText("Ticket price (₹)"), "abc");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(
      await screen.findByText("Capacity must be a whole number above 0"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter an amount like 0 or 499.50"),
    ).toBeInTheDocument();
  });

  it("hands the validated values to onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const start = dayFromNow(30);
    renderWithClient(<EventForm onSubmit={onSubmit} />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    await setValue("Start date", start);
    await setValue("End date", start);
    await pick(user, stateSelect(), "Maharashtra");
    await pick(user, venueSelect(), "Hotel Orchid");
    await user.type(screen.getByLabelText(/Event capacity/), "250");
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // The state is only a filter: the values carry the venue's id and nothing about the state.
    expect(submittedValues(onSubmit)).toEqual({
      title: "Tech Conf",
      startDate: start,
      startTime: "09:00",
      endDate: start,
      endTime: "17:00",
      venueId: SAMPLE_VENUES[2].id,
      capacity: "250",
      ticketPrice: "0",
    });
  });

  it("can be created without a venue", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const start = dayFromNow(30);
    renderWithClient(<EventForm onSubmit={onSubmit} />);
    await statesLoaded();

    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    await setValue("Start date", start);
    await setValue("End date", start);
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submittedValues(onSubmit)).toMatchObject({ venueId: "" });
  });

  it("describes the venue once one is chosen", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await pick(user, venueSelect(), "Hotel Orchid");

    expect(
      screen.getByText(/Plot 12, Baner Road, Pune 411045/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 active halls/)).toBeInTheDocument();
  });

  it("waits while a save is running: the button says so and the fields cannot change", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} isPending />);
    await statesLoaded().catch(() => undefined);

    const button = screen.getByRole("button", { name: "Creating event…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Event title")).toHaveAttribute("readonly");
    expect(stateSelect()).toBeDisabled();
  });

  it("shows why a save failed, above the form", async () => {
    renderWithClient(
      <EventForm
        onSubmit={jest.fn()}
        error="Could not create the event right now. Please try again."
      />,
    );
    await statesLoaded();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't create this event",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not create the event right now. Please try again.",
    );
  });
});

describe("EventForm: state, then venue", () => {
  it("starts with a state to choose and a venue that waits for it", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(stateSelect()).toHaveValue("");
    expect(venueSelect()).toBeDisabled();
    expect(venueSelect()).toHaveAttribute(
      "placeholder",
      "Choose a state first",
    );
  });

  it("does not ask the server for venues before a state is chosen", async () => {
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(venuesApi.list).not.toHaveBeenCalled();
  });

  it("lists the states the API sent, each with its code", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.click(stateSelect());

    expect(optionNames()).toEqual([
      "DelhiDL",
      "GoaGA",
      "GujaratGJ",
      "KarnatakaKA",
      "KeralaKL",
      "MaharashtraMH",
      "Tamil NaduTN",
    ]);
  });

  it("searches the states in the browser: no request per keystroke", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.click(stateSelect());
    await user.type(stateSelect(), "tam");
    expect(optionNames()).toEqual(["Tamil NaduTN"]);
    await user.clear(stateSelect());
    await user.type(stateSelect(), "ka");
    expect(optionNames()).toEqual(["KarnatakaKA"]);

    expect(statesApi.list).toHaveBeenCalledTimes(1);
  });

  it("asks the server for the active venues of the chosen state, by name", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Karnataka");

    await waitFor(() =>
      expect(venuesApi.list).toHaveBeenCalledWith({
        state: "Karnataka",
        status: "active",
        sort: "name",
        pageSize: 50,
      }),
    );
  });

  it("shows a loading box while the venues come, then lists only that state's venues", async () => {
    const user = userEvent.setup();
    let release: (value: ReturnType<typeof venueListFor>) => void = () => {};
    venuesApi.list.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    expect(venueSelect()).toBeDisabled();
    expect(venueSelect()).toHaveAttribute("placeholder", "Loading venues…");

    release(venueListFor("Maharashtra"));
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());
    expect(optionNames()).toEqual([
      "Choose a venue later",
      "Convention CentrePune",
      "Tech Park AuditoriumPune",
      "Hotel OrchidPune",
      "Harbour View Hotel & EventsMumbai",
      "Co-working HubPune",
    ]);
  });

  it("shows another state's own venues", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Karnataka");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());

    expect(optionNames()).toEqual([
      "Choose a venue later",
      "Orchard Tech Park AuditoriumBengaluru",
    ]);
  });

  it("searches the venues it was given, by name or by city", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());
    await user.type(venueSelect(), "orchid");
    expect(optionNames()).toEqual(["Hotel OrchidPune"]);
    await user.clear(venueSelect());
    await user.type(venueSelect(), "mumbai");
    expect(optionNames()).toEqual(["Harbour View Hotel & EventsMumbai"]);
  });

  it("says when a state has no active venue yet", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Kerala");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await user.click(venueSelect());

    expect(
      screen.getByText("No active venues in Kerala yet."),
    ).toBeInTheDocument();
  });

  it("allows choosing the venue later, and keeps the state", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await pick(user, venueSelect(), "Hotel Orchid");
    await pick(user, venueSelect(), "Choose a venue later");

    expect(venueSelect()).toHaveValue("");
    expect(screen.queryByText(/Plot 12, Baner Road/)).not.toBeInTheDocument();
    expect(stateSelect()).toHaveValue("Maharashtra");
  });

  it("clears the venue when another state is chosen, since it no longer fits", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await pick(user, venueSelect(), "Hotel Orchid");
    expect(venueSelect()).toHaveValue("Hotel Orchid");

    await pick(user, stateSelect(), "Karnataka");

    expect(venueSelect()).toHaveValue("");
    expect(screen.queryByText(/Plot 12, Baner Road/)).not.toBeInTheDocument();
  });

  it("keeps the venue when the same state is chosen again", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await pick(user, venueSelect(), "Hotel Orchid");
    await pick(user, stateSelect(), "Maharashtra");

    expect(venueSelect()).toHaveValue("Hotel Orchid");
  });

  it("does not submit the form when Enter picks a row", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await user.click(stateSelect());
    await user.type(stateSelect(), "goa{Enter}");

    expect(stateSelect()).toHaveValue("Goa");
    // Submitting would have shown the required-field errors.
    expect(
      screen.queryByText("Title must be at least 3 characters"),
    ).not.toBeInTheDocument();
  });

  it("says the states could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    statesApi.list.mockRejectedValueOnce(new Error("offline"));
    renderWithClient(<EventForm onSubmit={jest.fn()} />);

    expect(await screen.findByText(/Could not load the states/)).toBeVisible();
    expect(stateSelect()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await statesLoaded();
  });

  it("says the venues could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    venuesApi.list.mockRejectedValueOnce(new Error("offline"));
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    expect(await screen.findByText(/Could not load the venues/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(venueSelect()).toBeEnabled());
    expect(
      screen.queryByText(/Could not load the venues/),
    ).not.toBeInTheDocument();
  });
});

describe("EventForm: editing", () => {
  it("fills the form from the event, in the event's zone", async () => {
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(screen.getByLabelText("Event title")).toHaveValue(
      "Fintech Product Forum",
    );
    expect(
      screen.getByRole("button", { name: /Start date/ }),
    ).toHaveTextContent("Sat, 12 Dec 2026");
    expect(
      screen.getByRole("combobox", { name: /Start time/ }),
    ).toHaveTextContent("9:30 AM");
    expect(
      screen.getByRole("combobox", { name: /End time/ }),
    ).toHaveTextContent("5:30 PM");
    // A number input reports its value as a number.
    expect(screen.getByLabelText(/Event capacity/)).toHaveValue(250);
  });

  it("starts on the venue's state and venue, and asks for that state's venues", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(stateSelect()).toHaveValue("Maharashtra");
    expect(venueSelect()).toHaveValue("Hotel Orchid");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    expect(venuesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ state: "Maharashtra" }),
    );
    expect(screen.getByText(/2 active halls/)).toBeInTheDocument();
    await user.click(venueSelect());
    expect(optionNames()).toContain("Convention CentrePune");
  });

  it("keeps showing the event's own venue even when it is no longer in the active list", async () => {
    // An administrator deactivated the venue: the server no longer lists it.
    venuesApi.list.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    await waitFor(() => expect(venueSelect()).toBeEnabled());
    expect(venueSelect()).toHaveValue("Hotel Orchid");
  });

  it("starts with no state for an event that has no venue yet", async () => {
    renderWithClient(
      <EventForm event={{ ...fintech, venue: null }} onSubmit={jest.fn()} />,
    );
    await statesLoaded();

    expect(stateSelect()).toHaveValue("");
    expect(venueSelect()).toHaveValue("");
    expect(venueSelect()).toBeDisabled();
  });

  it("clears the venue when the state of an existing event is changed", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Goa");

    expect(venueSelect()).toHaveValue("");
    await waitFor(() => expect(venueSelect()).toBeEnabled());
    await pick(user, venueSelect(), "Beach Road");
    expect(venueSelect()).toHaveValue("Beach Road Convention Hall");
  });

  it("shows the public link as text, not an input", async () => {
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(
      screen.getByText(/Public link: \/events\/fintech-product-forum/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/public link|slug/i),
    ).not.toBeInTheDocument();
  });

  it("offers Save & continue, and Cancel and the publish check lead back to the overview", async () => {
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();

    expect(
      screen.getByRole("button", { name: "Save & continue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      eventHref(fintech.id),
    );
    expect(
      screen.getByRole("link", { name: "Check publish requirements" }),
    ).toHaveAttribute("href", eventHref(fintech.id));
  });

  it("says a published event is public", async () => {
    renderWithClient(
      <EventForm event={SAMPLE_EVENTS[0]} onSubmit={jest.fn()} />,
    );
    await statesLoaded();

    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(
      screen.getByText("This event is public and open for registration."),
    ).toBeInTheDocument();
  });

  it("says Saving… while the save runs", async () => {
    renderWithClient(
      <EventForm event={fintech} onSubmit={jest.fn()} isPending />,
    );
    await statesLoaded().catch(() => undefined);

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("shows why a save failed with its own heading", async () => {
    renderWithClient(
      <EventForm
        event={fintech}
        onSubmit={jest.fn()}
        error="The venue can't change once people have registered"
      />,
    );
    await statesLoaded();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't save your changes",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The venue can't change once people have registered",
    );
  });

  describe("an event that is already running", () => {
    // It started in 2020 and ends far in the future: its (past) start is not a mistake.
    const running: ManagedEvent = {
      ...fintech,
      status: "published",
      startAt: "2020-01-01T04:00:00.000Z",
      endAt: "2099-01-01T12:00:00.000Z",
    };

    it("can be saved with the start it already has", async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      renderWithClient(<EventForm event={running} onSubmit={onSubmit} />);
      await statesLoaded();

      await user.clear(screen.getByLabelText(/Event capacity/));
      await user.type(screen.getByLabelText(/Event capacity/), "300");
      await user.click(screen.getByRole("button", { name: "Save & continue" }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByText("The event must start in the future"),
      ).not.toBeInTheDocument();
    });

    it("shows its past start, but offers no past day for a new one", async () => {
      const user = userEvent.setup();
      renderWithClient(<EventForm event={running} onSubmit={jest.fn()} />);
      await statesLoaded();

      const start = screen.getByRole("button", { name: /^Start date/ });
      expect(start).toHaveTextContent("Wed, 1 Jan 2020");

      await user.click(start);
      expect(
        screen.getByRole("button", { name: "Go to the Previous Month" }),
      ).toHaveAttribute("aria-disabled", "true");
    });
  });
});

describe("EventForm: which halls are available", () => {
  const hallsOf = (...bookedHalls: string[]) =>
    ["Hall A", "Hall B"].map((name, index) => {
      const bookedSlots = bookedHalls.includes(name)
        ? [
            {
              startAt: "2026-12-12T04:30:00.000Z",
              endAt: "2026-12-12T06:30:00.000Z",
            },
          ]
        : [];
      return {
        id: `aaaaaaaa-0000-4000-8000-00000000000${index + 1}`,
        name,
        capacity: 100,
        busy: bookedSlots.length > 0,
        bookedSlots,
      };
    });

  async function chooseVenueAndDates(user: User, start: string, end = start) {
    await pick(user, stateSelect(), "Maharashtra");
    await pick(user, venueSelect(), "Hotel Orchid");
    await setValue("Start date", start);
    await setValue("End date", end);
  }

  it("asks for the dates first, and sends nothing until there is a range", async () => {
    const user = userEvent.setup();
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await pick(user, stateSelect(), "Maharashtra");
    await pick(user, venueSelect(), "Hotel Orchid");

    expect(
      screen.getByText(
        "Choose the start and end dates to see which halls are available.",
      ),
    ).toBeInTheDocument();
    expect(venuesApi.getHallAvailability).not.toHaveBeenCalled();
  });

  it("shows the halls of the chosen venue once the dates are filled in", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    venuesApi.getHallAvailability.mockResolvedValue(hallsOf("Hall B"));
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await chooseVenueAndDates(user, start);

    expect(
      await screen.findByText("1 of 2 halls are available on these dates."),
    ).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("12 Dec, 10:00–12:00")).toBeInTheDocument();
  });

  it("asks about the venue that was picked, for the dates and times in the form (India time)", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    venuesApi.getHallAvailability.mockResolvedValue(hallsOf());
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();

    await chooseVenueAndDates(user, start);

    await waitFor(() =>
      expect(venuesApi.getHallAvailability).toHaveBeenCalledWith(
        SAMPLE_VENUES[2].id,
        {
          startAt: `${start}T09:00:00+05:30`,
          endAt: `${start}T17:00:00+05:30`,
        },
      ),
    );
  });

  it("asks again when a date changes, and shows the loading state for the new range", async () => {
    const user = userEvent.setup();
    const start = dayFromNow(30);
    venuesApi.getHallAvailability.mockResolvedValue(hallsOf());
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();
    await chooseVenueAndDates(user, start);
    await screen.findByText("2 of 2 halls are available on these dates.");

    // The next range is answered later: the old halls must not stay on screen meanwhile.
    venuesApi.getHallAvailability.mockReturnValue(new Promise(() => {}));
    await setValue("End date", dayFromNow(31));

    expect(
      await screen.findByRole("status", {
        name: "Checking which halls are available",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("2 of 2 halls are available on these dates."),
    ).not.toBeInTheDocument();
  });

  it("warns when no hall is available, and still lets the event be saved", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const start = dayFromNow(30);
    venuesApi.getHallAvailability.mockResolvedValue(
      hallsOf("Hall A", "Hall B"),
    );
    renderWithClient(<EventForm onSubmit={onSubmit} />);
    await statesLoaded();
    await user.type(screen.getByLabelText("Event title"), "Tech Conf");
    await chooseVenueAndDates(user, start);
    await user.type(screen.getByLabelText("Ticket price (₹)"), "0");

    expect(
      await screen.findByText(/No hall is available for all of these dates/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("does not check the halls for a range the server would refuse (end before start)", async () => {
    const user = userEvent.setup();
    venuesApi.getHallAvailability.mockResolvedValue(hallsOf());
    renderWithClient(<EventForm onSubmit={jest.fn()} />);
    await statesLoaded();
    await chooseVenueAndDates(user, dayFromNow(30));
    await screen.findByText("2 of 2 halls are available on these dates.");

    // The end can not be chosen before the start, but the start can be moved past the end.
    venuesApi.getHallAvailability.mockClear();
    await setValue("Start date", dayFromNow(31));

    expect(venuesApi.getHallAvailability).not.toHaveBeenCalled();
  });

  it("is not shown when editing an event: its own sessions would look like bookings", async () => {
    renderWithClient(<EventForm event={fintech} onSubmit={jest.fn()} />);
    await statesLoaded();
    await waitFor(() => expect(venueSelect()).toBeEnabled());

    expect(venuesApi.getHallAvailability).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/halls? (is|are) available on these dates/),
    ).not.toBeInTheDocument();
  });
});
