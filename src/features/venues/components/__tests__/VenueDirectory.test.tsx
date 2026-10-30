/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import { fakeListVenues, LIST_VENUES } from "../../__fixtures__/venue-list";
import { venueApiService } from "../../api/venue-api.service";
import { VenueDirectory } from "../VenueDirectory";

// Only the API layer and the permission check are replaced: the hooks, the cache and the screens
// are the real ones.
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
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const api = jest.mocked(venueApiService);
const hasPermission = jest.mocked(useHasPermission);

const gift = LIST_VENUES[0];

/** `client` lets a test keep one cache across two visits, like the app's QueryProvider does. */
function renderPage(
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={client}>
      <VenueDirectory />
    </QueryClientProvider>,
  );
}

const cards = () =>
  within(screen.getAllByRole("list")[0]).getAllByRole("listitem");
const searchBox = () =>
  screen.getByRole("searchbox", { name: "Search venues" });

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(false);
  // A fake of GET /api/venues: it filters, searches, sorts and pages like the real route.
  api.list.mockImplementation(async (params) => fakeListVenues(params));
});

describe("VenueDirectory", () => {
  it("shows a skeleton, then the active venues only, as cards", async () => {
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading venues" }),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "5 venues" }),
    ).toBeInTheDocument();
    expect(cards()).toHaveLength(5);
    expect(
      screen.queryByText("Old Mill Community Hall"),
    ).not.toBeInTheDocument();
    // Always asks for active venues, whoever is looking.
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });

  it("shows where a venue is and how many halls are open, and links to its page", async () => {
    renderPage();

    const link = await screen.findByRole("link", { name: gift.name });
    expect(link).toHaveAttribute("href", `/venues/${gift.id}`);
    const card = link.closest("li");
    expect(card).toHaveTextContent("Gandhinagar, Gujarat");
    expect(card).toHaveTextContent("Block 12, Zone 1, GIFT City");
    // Only the active halls: 3 of its 4.
    expect(card).toHaveTextContent("3 halls");
  });

  it("searches by city as the visitor types, with no Search button to press", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "5 venues" });

    expect(
      screen.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await userEvent.type(searchBox(), "pune");

    expect(
      await screen.findByRole("heading", { name: "1 venue matches “pune”" }),
    ).toBeInTheDocument();
    expect(cards()[0]).toHaveTextContent("Lakeside Conference Centre");
    // Debounced: the API is asked for the word once typing stops, not for every letter.
    for (const partial of ["p", "pu", "pun"]) {
      expect(api.list).not.toHaveBeenCalledWith(
        expect.objectContaining({ search: partial }),
      );
    }
  });

  it("says when nothing matches, and clears the search", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "5 venues" });

    await userEvent.type(searchBox(), "zzz");

    expect(
      await screen.findByText("No venues match your search."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(
      await screen.findByRole("heading", { name: "5 venues" }),
    ).toBeInTheDocument();
    expect(searchBox()).toHaveValue("");
  });

  it("sorts by the number of halls", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "5 venues" });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "halls",
    );

    await waitFor(() =>
      expect(cards()[0]).toHaveTextContent("Harbour View Hotel & Events"),
    );
    expect(screen.getByText("Sorted by Most halls")).toBeInTheDocument();
  });

  it("says there are no venues yet when the list is empty", async () => {
    api.list.mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 12, total: 0 },
    });
    renderPage();

    expect(await screen.findByText("No venues yet.")).toBeInTheDocument();
  });

  it("shows a failed load with a way to try again", async () => {
    api.list.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "Boom"));
    renderPage();

    expect(
      await screen.findByText("We couldn't load the venues"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "5 venues" }),
    ).toBeInTheDocument();
  });

  it("asks the server again on every visit, so a venue deactivated in the meantime is gone", async () => {
    // The app keeps answers for 60 s: Discover must not use that.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const first = renderPage(client);
    await screen.findByRole("heading", { name: "5 venues" });
    first.unmount();

    // Meanwhile an admin deactivates GIFT City in another browser.
    api.list.mockImplementation(async (params) => {
      const page = fakeListVenues(params);
      const items = page.items.filter((venue) => venue.id !== gift.id);
      return { items, meta: { ...page.meta, total: items.length } };
    });
    renderPage(client);

    // No cached copy: the skeleton, then the server's new answer without that venue.
    expect(
      screen.getByRole("status", { name: "Loading venues" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "4 venues" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(gift.name)).not.toBeInTheDocument();
  });

  it("links to the admin page only for someone who manages venues", async () => {
    const { unmount } = renderPage();
    await screen.findByRole("heading", { name: "5 venues" });
    expect(
      screen.queryByRole("link", { name: "Manage venues" }),
    ).not.toBeInTheDocument();
    unmount();

    hasPermission.mockImplementation((code) => code === "VENUE_MANAGE");
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Manage venues" }),
    ).toHaveAttribute("href", "/admin/venues");
  });
});
