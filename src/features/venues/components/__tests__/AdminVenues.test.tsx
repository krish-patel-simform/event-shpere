/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { fakeListVenues, LIST_VENUES } from "../../__fixtures__/venue-list";
import { giftCity } from "../../__fixtures__/venues";
import { venueApiService } from "../../api/venue-api.service";
import { AdminVenues } from "../AdminVenues";

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

const gift = LIST_VENUES[0];
const oldMill = LIST_VENUES[5];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminVenues />
    </QueryClientProvider>,
  );
}

const panel = () => screen.getByRole("tabpanel");
const bodyRows = () => within(panel()).getAllByRole("row").slice(1);

beforeEach(() => {
  jest.resetAllMocks();
  // A fake of GET /api/venues: it filters, searches, sorts and pages like the real route.
  api.list.mockImplementation(async (params) => fakeListVenues(params));
});

describe("AdminVenues: the list", () => {
  it("shows a skeleton while loading, then every venue with its hall counts and status", async () => {
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading venues" }),
    ).toBeInTheDocument();

    expect(await screen.findByText("6 in total")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(6);

    const giftRow = screen.getByRole("row", { name: /GIFT City Convention/ });
    expect(giftRow).toHaveTextContent("Gandhinagar");
    expect(giftRow).toHaveTextContent("4 halls");
    expect(giftRow).toHaveTextContent("3 active · 1 inactive");
    expect(giftRow).toHaveTextContent("520");
    expect(giftRow).toHaveTextContent("Active");
    expect(screen.getByRole("row", { name: /Old Mill/ })).toHaveTextContent(
      "Inactive",
    );
  });

  it("links each venue to its page", async () => {
    renderPage();

    expect(
      await screen.findByRole("link", { name: gift.name }),
    ).toHaveAttribute("href", `/admin/venues/${gift.id}`);
  });

  it("lists only the venues of the selected tab, and shows the skeleton, not the old rows, while it loads", async () => {
    renderPage();
    await screen.findByText("6 in total");

    // The next request is held, so the page is between the two lists.
    let release: () => void = () => undefined;
    api.list.mockImplementationOnce(
      (params) =>
        new Promise((resolve) => {
          release = () => resolve(fakeListVenues(params));
        }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Inactive" }));

    expect(
      screen.getByRole("status", { name: "Loading venues" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(gift.name)).not.toBeInTheDocument();

    release();
    expect(await screen.findByText("1 in total")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent(oldMill.name);
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "inactive" }),
    );
  });

  it("searches by name or city after the admin stops typing", async () => {
    renderPage();
    await screen.findByText("6 in total");

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search venues" }),
      "pune",
    );

    expect(await screen.findByText("1 matching")).toBeInTheDocument();
    expect(bodyRows()[0]).toHaveTextContent("Lakeside Conference Centre");
  });

  it("says nothing matches a search that finds no venue", async () => {
    renderPage();
    await screen.findByText("6 in total");

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search venues" }),
      "zzz",
    );

    expect(
      await screen.findByText(/No venues match your search/),
    ).toBeInTheDocument();
  });

  it("sorts by the number of halls", async () => {
    renderPage();
    await screen.findByText("6 in total");

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "halls",
    );

    await waitFor(() =>
      expect(bodyRows()[0]).toHaveTextContent("Harbour View"),
    );
  });

  it("invites the admin to add the first venue when there are none", async () => {
    api.list.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    });
    renderPage();

    expect(await screen.findByText("No venues yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Add venue" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/venues/new",
      "/admin/venues/new",
    ]);
  });

  it("shows a failed load with a way to try again", async () => {
    api.list.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "Boom"));
    renderPage();

    expect(
      await screen.findByText("We couldn't load the venues"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("6 in total")).toBeInTheDocument();
  });
});

describe("AdminVenues: a row's menu", () => {
  const openMenu = async (venueName: string) => {
    await userEvent.click(
      await screen.findByRole("button", { name: `Actions for ${venueName}` }),
    );
    return screen.getByRole("menu", { name: `Actions for ${venueName}` });
  };

  it("deactivates a venue after asking", async () => {
    api.setStatus.mockResolvedValue({
      ...giftCity,
      id: gift.id,
      isActive: false,
    });
    renderPage();

    const menu = await openMenu(gift.name);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Deactivate venue" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: `Deactivate ${gift.name}?`,
    });
    expect(
      within(dialog).getByText(/All 4 halls become inactive/),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Deactivate venue" }),
    );

    expect(api.setStatus).toHaveBeenCalledWith(gift.id, {
      isActive: false,
      activateHalls: "none",
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: `Deactivate ${gift.name}?` }),
      ).not.toBeInTheDocument(),
    );
  });

  it("adds a hall to an active venue", async () => {
    api.addHall.mockResolvedValue({ ...giftCity, id: gift.id });
    renderPage();

    const menu = await openMenu(gift.name);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Add a hall" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Add a hall" });
    await userEvent.type(within(dialog).getByLabelText("Hall name"), "Hall E");
    await userEvent.type(within(dialog).getByLabelText("Seats"), "40");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add hall" }),
    );

    expect(api.addHall).toHaveBeenCalledWith(gift.id, {
      name: "Hall E",
      capacity: 40,
    });
  });

  it("offers to activate an inactive venue instead of adding a hall or deactivating it", async () => {
    renderPage();

    const menu = await openMenu(oldMill.name);

    expect(
      within(menu).getByRole("menuitem", { name: "Activate venue" }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Add a hall" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Deactivate venue" }),
    ).not.toBeInTheDocument();
  });
});
