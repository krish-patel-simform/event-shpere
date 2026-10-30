/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { useHasPermission } from "@/src/features/auth";
import { giftCity, venueId } from "../../__fixtures__/venues";
import { venueApiService } from "../../api/venue-api.service";
import type { VenueDetailDto } from "../../schemas/venue.schemas";
import { VenueProfile } from "../VenueProfile";

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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VenueProfile venueId={venueId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(false);
});

describe("VenueProfile", () => {
  it("shows a skeleton, then the venue with only its active halls and their capacity", async () => {
    let release: (venue: VenueDetailDto) => void = () => undefined;
    api.get.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderPage();

    expect(
      screen.getByRole("status", { name: "Loading venue" }),
    ).toBeInTheDocument();

    // An admin gets the inactive Rooftop Lounge from the API too: Discover hides it.
    release(giftCity);
    expect(
      await screen.findByRole("heading", { name: giftCity.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Block 12, Zone 1, GIFT City, Gandhinagar, Gujarat, 382355, IN",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 halls open")).toBeInTheDocument();
    expect(screen.getByText("Time zone: Asia/Kolkata")).toBeInTheDocument();
    expect(screen.getByText("Main Auditorium")).toBeInTheDocument();
    expect(screen.getByText("Capacity 300")).toBeInTheDocument();
    expect(screen.getByText("Workshop Room 1")).toBeInTheDocument();
    expect(screen.queryByText("Rooftop Lounge")).not.toBeInTheDocument();
  });

  it("links to the map when the venue has a map pin, and not without one", async () => {
    api.get.mockResolvedValueOnce(giftCity);
    const { unmount } = renderPage();

    expect(
      await screen.findByRole("link", { name: "View on map" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=23.16,72.68",
    );
    unmount();

    api.get.mockResolvedValueOnce({
      ...giftCity,
      latitude: null,
      longitude: null,
    });
    renderPage();
    await screen.findByRole("heading", { name: giftCity.name });
    expect(
      screen.queryByRole("link", { name: "View on map" }),
    ).not.toBeInTheDocument();
  });

  it("says so when no hall is open", async () => {
    api.get.mockResolvedValue({
      ...giftCity,
      halls: giftCity.halls.map((hall) => ({ ...hall, isActive: false })),
    });
    renderPage();

    expect(
      await screen.findByText("No halls are open at this venue right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("No halls open")).toBeInTheDocument();
  });

  it("says the venue was not found when the API answers 404", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Venue not found"),
    );
    renderPage();

    expect(await screen.findByText("Venue not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to venues" }),
    ).toHaveAttribute("href", "/venues");
  });

  it("hides an inactive venue from an admin too, like from everyone else", async () => {
    api.get.mockResolvedValue({ ...giftCity, isActive: false });
    renderPage();

    expect(await screen.findByText("Venue not found")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: giftCity.name }),
    ).not.toBeInTheDocument();
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

  it("links to the admin page only for someone who manages venues", async () => {
    api.get.mockResolvedValue(giftCity);
    const { unmount } = renderPage();
    await screen.findByRole("heading", { name: giftCity.name });
    expect(
      screen.queryByRole("link", { name: "Manage venue" }),
    ).not.toBeInTheDocument();
    unmount();

    hasPermission.mockImplementation((code) => code === "VENUE_MANAGE");
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Manage venue" }),
    ).toHaveAttribute("href", `/admin/venues/${venueId}`);
  });
});
