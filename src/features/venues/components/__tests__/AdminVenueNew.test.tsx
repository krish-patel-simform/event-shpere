/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { venueApiService } from "../../api/venue-api.service";
import { AdminVenueNew } from "../AdminVenueNew";

// The form's own behavior (validation, save, server errors) is in CreateVenueForm.test.tsx;
// this page only frames it.
jest.mock("../../api/venue-api.service", () => ({
  venueApiService: { create: jest.fn() },
}));
const api = jest.mocked(venueApiService);

jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
const statesApi = jest.mocked(stateApiService);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminVenueNew />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue([]);
});

describe("AdminVenueNew", () => {
  it("shows the Add venue heading with a breadcrumb back to the venue list", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Add venue" }),
    ).toBeVisible();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumb).getByRole("link", { name: "Venues" }),
    ).toHaveAttribute("href", "/admin/venues");
    expect(within(breadcrumb).getByText("Add venue")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an empty venue form with its first hall, and sends nothing on its own", async () => {
    renderPage();

    expect(screen.getByLabelText("Venue name")).toHaveValue("");
    expect(screen.getAllByLabelText("Hall name")[0]).toHaveValue("");
    // The state list is loaded for the form; no venue is created until the admin saves.
    await screen.findByLabelText("State");
    expect(api.create).not.toHaveBeenCalled();
  });
});
