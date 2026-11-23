/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { giftCity, venueId } from "../../__fixtures__/venues";
import { venueApiService } from "../../api/venue-api.service";
import { AdminVenueEdit } from "../AdminVenueEdit";

// Only the API layer is replaced: the query hook and the form are the real ones.
jest.mock("../../api/venue-api.service", () => ({
  venueApiService: { get: jest.fn(), update: jest.fn() },
}));
const api = jest.mocked(venueApiService);

jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
const statesApi = jest.mocked(stateApiService);

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const gujarat = {
  id: "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b",
  name: "Gujarat",
  code: "IN-GJ",
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminVenueEdit venueId={venueId} />
    </QueryClientProvider>,
  );
}

const breadcrumb = () => screen.getByRole("navigation", { name: "Breadcrumb" });

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue([gujarat]);
  api.get.mockResolvedValue(giftCity);
  api.update.mockResolvedValue(giftCity);
});

describe("AdminVenueEdit", () => {
  it("shows a loading placeholder while the venue is loading", () => {
    // Never answers, so the page stays in its loading state.
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("status", { name: "Loading venue" })).toBeVisible();
    expect(
      within(breadcrumb()).getByRole("link", { name: "Venues" }),
    ).toHaveAttribute("href", "/admin/venues");
    expect(screen.queryByLabelText("Venue name")).not.toBeInTheDocument();
  });

  it("loads the venue it was given and fills the form with it", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Edit venue" }),
    ).toBeVisible();
    expect(api.get).toHaveBeenCalledWith(venueId);
    expect(screen.getByLabelText("Venue name")).toHaveValue(giftCity.name);
    expect(
      within(breadcrumb()).getByRole("link", { name: giftCity.name }),
    ).toHaveAttribute("href", `/admin/venues/${venueId}`);
    expect(within(breadcrumb()).getByText("Edit")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("saves a change and goes back to the venue's page", async () => {
    renderPage();

    const city = await screen.findByLabelText("City");
    await userEvent.clear(city);
    await userEvent.type(city, "Surat");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(venueId, { city: "Surat" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/admin/venues/${venueId}`),
    );
  });

  it("says the venue was not found on a 404, with a way back to the list", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Venue not found"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Venue not found")).toBeVisible();
    expect(
      within(alert).getByRole("link", { name: "Back to venues" }),
    ).toHaveAttribute("href", "/admin/venues");
    // A missing venue cannot be fixed by trying again.
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Venue name")).not.toBeInTheDocument();
  });

  it("shows the server's error and loads the venue again on Try again", async () => {
    api.get.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL", "The server had a problem"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("We couldn't load this venue"),
    ).toBeVisible();
    expect(within(alert).getByText("The server had a problem")).toBeVisible();

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    expect(await screen.findByLabelText("Venue name")).toHaveValue(
      giftCity.name,
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("treats an error that is not from the API (e.g. a bad response) as a retryable failure", async () => {
    api.get.mockRejectedValueOnce(new Error("Unexpected server response"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("We couldn't load this venue"),
    ).toBeVisible();
    expect(
      within(alert).getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  });
});
