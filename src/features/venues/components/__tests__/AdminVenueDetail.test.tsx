/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  giftCity,
  hallIds,
  mainAuditorium,
  rooftopLounge,
  venueId,
  workshopRoom,
} from "../../__fixtures__/venues";
import { LIST_VENUES } from "../../__fixtures__/venue-list";
import { venueApiService } from "../../api/venue-api.service";
import { venueQueryKeys } from "../../hooks/venue-cache";
import type { VenueDetailDto } from "../../schemas/venue.schemas";
import { AdminVenueDetail } from "../AdminVenueDetail";

// Only the API layer is replaced: the hooks, the cache and the screens are the real ones.
jest.mock("../../api/venue-api.service", () => ({
  venueApiService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    setStatus: jest.fn(),
    setHallsStatus: jest.fn(),
    addHall: jest.fn(),
    deleteHall: jest.fn(),
  },
}));
const api = jest.mocked(venueApiService);

/**
 * A fake server holding one venue: each change updates it and answers with the venue as it is
 * now, like the real routes do.
 */
function serve(initial: VenueDetailDto = giftCity) {
  let current: VenueDetailDto = { ...initial, halls: [...initial.halls] };
  const answer = (): VenueDetailDto => ({
    ...current,
    halls: current.halls.map((hall) => ({ ...hall })),
  });

  api.get.mockImplementation(async () => answer());
  api.setStatus.mockImplementation(async (_id, body) => {
    current = {
      ...current,
      isActive: body.isActive,
      halls: current.halls.map((hall) => ({
        ...hall,
        isActive:
          !body.isActive || body.activateHalls === "all"
            ? body.isActive
            : hall.isActive,
      })),
    };
    return answer();
  });
  api.setHallsStatus.mockImplementation(async (_id, body) => {
    const ids = body.halls === "all" ? null : body.halls;
    current = {
      ...current,
      halls: current.halls.map((hall) =>
        ids === null || ids.includes(hall.id)
          ? { ...hall, isActive: body.isActive }
          : hall,
      ),
    };
    return answer();
  });
  api.addHall.mockImplementation(async (_id, body) => {
    current = {
      ...current,
      halls: [
        ...current.halls,
        {
          id: "d0000000-0000-4000-8000-000000000004",
          name: body.name,
          capacity: body.capacity,
          sortOrder: current.halls.length,
          isActive: true,
        },
      ],
    };
    return answer();
  });
  api.deleteHall.mockImplementation(async (_id, hallId) => {
    current = {
      ...current,
      halls: current.halls.filter((hall) => hall.id !== hallId),
    };
    return answer();
  });
}

/** `client` lets a test start with a cache, e.g. the Venues list the admin came from. */
function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <AdminVenueDetail venueId={venueId} />
    </QueryClientProvider>,
  );
}

/** The page once the venue has loaded. */
async function renderLoaded(initial?: VenueDetailDto) {
  serve(initial);
  renderPage();
  await screen.findByRole("heading", { name: giftCity.name });
}

/** The status badge next to the venue's name (the halls have their own badges). */
const venueStatus = () =>
  screen.getByRole("heading", { level: 1 }).nextElementSibling;

const row = (hallName: string) =>
  screen.getByRole("row", { name: new RegExp(hallName) });

beforeEach(() => jest.resetAllMocks());

describe("AdminVenueDetail: loading the venue", () => {
  it("shows a skeleton while loading, then the venue, its halls and its details", async () => {
    let release: (venue: VenueDetailDto) => void = () => undefined;
    api.get.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading venue" }),
    ).toBeInTheDocument();

    release(giftCity);
    expect(
      await screen.findByRole("heading", { name: giftCity.name }),
    ).toBeInTheDocument();
    expect(venueStatus()).toHaveTextContent("Active");
    expect(
      screen.getByText(/3 halls · 440 seats · 2 active, 1 inactive/),
    ).toBeVisible();
    expect(row("Main Auditorium")).toHaveTextContent("300");
    expect(row("Rooftop Lounge")).toHaveTextContent("Inactive");
    expect(screen.getByText("382355")).toBeInTheDocument();
    expect(screen.getByText("23.16, 72.68")).toBeInTheDocument();
  });

  it("says when the venue does not exist", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Venue not found"),
    );
    renderPage();

    expect(await screen.findByText("Venue not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to venues" }),
    ).toHaveAttribute("href", "/admin/venues");
  });

  it("shows any other failure with a way to try again", async () => {
    api.get.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "Boom"));
    renderPage();

    expect(
      await screen.findByText("We couldn't load this venue"),
    ).toBeInTheDocument();

    api.get.mockResolvedValue(giftCity);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: giftCity.name }),
    ).toBeInTheDocument();
  });
});

describe("AdminVenueDetail: name from the list and the map", () => {
  it("shows the venue's name at once when the admin comes from the list, while the halls load", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // The Venues list page the admin came from is already in the cache.
    client.setQueryData(
      venueQueryKeys.list({ page: 1, pageSize: 10, sort: "name" }),
      {
        items: [{ ...LIST_VENUES[0], id: venueId }],
        meta: { page: 1, pageSize: 10, total: 1 },
      },
    );
    let release: (venue: VenueDetailDto) => void = () => undefined;
    api.get.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderPage(client);

    // Still loading the halls, but the name is in the heading and the breadcrumb already.
    expect(
      screen.getByRole("status", { name: "Loading venue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: giftCity.name }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText(
        giftCity.name,
      ),
    ).toBeInTheDocument();

    release(giftCity);
    expect(await screen.findByText("Main Auditorium")).toBeInTheDocument();
  });

  it("shows a generic name while loading when opened by URL (nothing is known yet)", () => {
    api.get.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText(
        "Venue",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("opens the map pin in Google Maps from the header and from the details", async () => {
    await renderLoaded();

    const links = screen.getAllByRole("link", {
      name: `Open ${giftCity.name} in Google Maps (new tab)`,
    });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        "https://www.google.com/maps/search/?api=1&query=23.16,72.68",
      );
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("has no map icon when the venue has no map pin", async () => {
    await renderLoaded({ ...giftCity, latitude: null, longitude: null });

    expect(
      screen.queryByRole("link", { name: /in Google Maps/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });
});

describe("AdminVenueDetail: activating and deactivating halls", () => {
  it("turns one hall off from its row", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "Deactivate Main Auditorium" }),
    );

    expect(api.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: false,
      halls: [hallIds.main],
    });
    await waitFor(() =>
      expect(row("Main Auditorium")).toHaveTextContent("Inactive"),
    );
  });

  it("turns one hall on from its row", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "Activate Rooftop Lounge" }),
    );

    expect(api.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      halls: [hallIds.lounge],
    });
    await waitFor(() =>
      expect(row("Rooftop Lounge")).toHaveTextContent("Active"),
    );
  });

  it("turns the ticked halls off together, then clears the selection", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Main Auditorium" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select Workshop Room 1" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Deactivate selected" }),
    );

    expect(api.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: false,
      halls: [hallIds.main, hallIds.workshop],
    });
    await waitFor(() =>
      expect(screen.queryByText("2 selected")).not.toBeInTheDocument(),
    );
    expect(row("Workshop Room 1")).toHaveTextContent("Inactive");
  });

  it("selects every hall with the header box", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select all halls" }),
    );

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("shows why a change was refused", async () => {
    await renderLoaded();
    api.setHallsStatus.mockRejectedValue(
      new ApiError(
        409,
        "VENUE_INACTIVE",
        "Activate the venue before activating its halls",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Activate Rooftop Lounge" }),
    );

    expect(
      await screen.findByText("We couldn't update those halls"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Activate the venue before activating its halls"),
    ).toBeInTheDocument();
  });
});

describe("AdminVenueDetail: adding a hall", () => {
  it("adds a hall and shows it at the end of the list", async () => {
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Add hall" }));
    const dialog = screen.getByRole("dialog", { name: "Add a hall" });
    await userEvent.type(within(dialog).getByLabelText("Hall name"), "Hall C");
    // Letters are dropped as they are typed: only the digits stay.
    await userEvent.type(within(dialog).getByLabelText("Seats"), "1a2b0c");
    expect(within(dialog).getByLabelText("Seats")).toHaveValue("120");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add hall" }),
    );

    expect(api.addHall).toHaveBeenCalledWith(venueId, {
      name: "Hall C",
      capacity: 120,
    });
    expect(
      await screen.findByRole("row", { name: /Hall C/ }),
    ).toHaveTextContent("120");
    expect(
      screen.queryByRole("dialog", { name: "Add a hall" }),
    ).not.toBeInTheDocument();
  });

  it("checks the fields before asking the server", async () => {
    await renderLoaded();

    await userEvent.click(screen.getByRole("button", { name: "Add hall" }));
    const dialog = screen.getByRole("dialog", { name: "Add a hall" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add hall" }),
    );

    expect(
      await within(dialog).findByText("Hall name is required"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Seats are required")).toBeInTheDocument();
    expect(api.addHall).not.toHaveBeenCalled();
  });

  it("shows a taken name under the name field and keeps the dialog open", async () => {
    await renderLoaded();
    api.addHall.mockRejectedValue(
      new ApiError(
        409,
        "HALL_EXISTS",
        'This venue already has a hall named "main auditorium"',
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add hall" }));
    const dialog = screen.getByRole("dialog", { name: "Add a hall" });
    await userEvent.type(
      within(dialog).getByLabelText("Hall name"),
      "main auditorium",
    );
    await userEvent.type(within(dialog).getByLabelText("Seats"), "50");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add hall" }),
    );

    expect(
      await within(dialog).findByText(
        'This venue already has a hall named "main auditorium"',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Hall name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});

describe("AdminVenueDetail: deleting a hall", () => {
  it("deletes a hall after asking, and the hall leaves the list", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Rooftop Lounge" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Rooftop Lounge?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete hall" }),
    );

    expect(api.deleteHall).toHaveBeenCalledWith(venueId, hallIds.lounge);
    await waitFor(() =>
      expect(
        screen.queryByRole("row", { name: /Rooftop Lounge/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("does not offer to delete the only hall", async () => {
    await renderLoaded({ ...giftCity, halls: [mainAuditorium] });

    expect(
      screen.getByRole("button", { name: "Delete Main Auditorium" }),
    ).toBeDisabled();
  });

  it("explains that a hall with sessions cannot be deleted, and offers to turn it off", async () => {
    await renderLoaded();
    api.deleteHall.mockRejectedValue(
      new ApiError(409, "HALL_IN_USE", "Sessions are scheduled in this hall"),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Workshop Room 1" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Workshop Room 1?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete hall" }),
    );

    expect(
      await within(dialog).findByText(/it cannot be deleted/),
    ).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate instead" }),
    );

    expect(api.setHallsStatus).toHaveBeenCalledWith(venueId, {
      isActive: false,
      halls: [hallIds.workshop],
    });
    await waitFor(() =>
      expect(row("Workshop Room 1")).toHaveTextContent("Inactive"),
    );
  });

  it("explains that the last hall cannot be deleted when the server says so", async () => {
    await renderLoaded();
    api.deleteHall.mockRejectedValue(
      new ApiError(409, "LAST_HALL", "A venue must keep at least one hall"),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Rooftop Lounge" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Delete Rooftop Lounge?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete hall" }),
    );

    expect(
      await within(dialog).findByText(/must keep at least one hall/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Delete hall" }),
    ).toBeDisabled();
  });
});

describe("AdminVenueDetail: deactivating and activating the venue", () => {
  it("deactivates the venue after warning that its halls become inactive, then shows it as inactive", async () => {
    await renderLoaded();

    await userEvent.click(
      screen.getByRole("button", { name: "Deactivate venue" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: `Deactivate ${giftCity.name}?`,
    });
    expect(
      within(dialog).getByText(/All 3 halls become inactive/),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate venue" }),
    );

    expect(api.setStatus).toHaveBeenCalledWith(venueId, {
      isActive: false,
      activateHalls: "none",
    });
    expect(
      await screen.findByText("This venue is inactive"),
    ).toBeInTheDocument();
    expect(venueStatus()).toHaveTextContent("Inactive");
    expect(
      screen.getByRole("button", { name: "Activate venue" }),
    ).toBeInTheDocument();
    // No hall can be activated, or added, while the venue is inactive.
    expect(
      screen.getByRole("button", { name: "Activate Main Auditorium" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add hall" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Deactivate venue" }),
    ).not.toBeInTheDocument();
  });

  it("activates the venue only, keeping its halls inactive, by default", async () => {
    await renderLoaded({
      ...giftCity,
      isActive: false,
      halls: [mainAuditorium, workshopRoom, rooftopLounge].map((hall) => ({
        ...hall,
        isActive: false,
      })),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Activate venue" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: `Activate ${giftCity.name}?`,
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Activate venue" }),
    );

    expect(api.setStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      activateHalls: "none",
    });
    await waitFor(() => expect(venueStatus()).toHaveTextContent("Active"));
    expect(row("Main Auditorium")).toHaveTextContent("Inactive");
  });

  it("activates the venue and all its halls when asked", async () => {
    await renderLoaded({
      ...giftCity,
      isActive: false,
      halls: [mainAuditorium, workshopRoom].map((hall) => ({
        ...hall,
        isActive: false,
      })),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Activate venue" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: `Activate ${giftCity.name}?`,
    });
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Venue and all 2 halls/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Activate venue" }),
    );

    expect(api.setStatus).toHaveBeenCalledWith(venueId, {
      isActive: true,
      activateHalls: "all",
    });
    await waitFor(() =>
      expect(row("Main Auditorium")).toHaveTextContent("Active"),
    );
  });

  it("keeps the dialog open and says why when the server refuses", async () => {
    await renderLoaded();
    api.setStatus.mockRejectedValue(new ApiError(500, "UNKNOWN", "Boom"));

    await userEvent.click(
      screen.getByRole("button", { name: "Deactivate venue" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: `Deactivate ${giftCity.name}?`,
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate venue" }),
    );

    expect(
      await within(dialog).findByText("We couldn't deactivate this venue"),
    ).toBeInTheDocument();
  });
});
