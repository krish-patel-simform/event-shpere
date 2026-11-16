/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { giftCity, venueId } from "../../__fixtures__/venues";
import { venueApiService } from "../../api/venue-api.service";
import { EditVenueForm } from "../EditVenueForm";

jest.mock("../../api/venue-api.service", () => ({
  venueApiService: { update: jest.fn() },
}));
const api = jest.mocked(venueApiService);

jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
const statesApi = jest.mocked(stateApiService);

const states = [
  { id: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", name: "Goa", code: "IN-GA" },
  {
    id: "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b",
    name: "Gujarat",
    code: "IN-GJ",
  },
];

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditVenueForm venue={giftCity} />
    </QueryClientProvider>,
  );
}

const replace = async (label: string | RegExp, text: string) => {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  if (text) await userEvent.type(field, text);
};

const save = () =>
  userEvent.click(screen.getByRole("button", { name: "Save changes" }));

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue(states);
  api.update.mockResolvedValue(giftCity);
});

describe("EditVenueForm", () => {
  it("starts with the venue's current values", async () => {
    renderForm();

    expect(screen.getByLabelText("Venue name")).toHaveValue(giftCity.name);
    expect(screen.getByLabelText("Address")).toHaveValue(giftCity.addressLine);
    expect(screen.getByLabelText("City")).toHaveValue("Gandhinagar");
    expect(screen.getByLabelText(/Postal code/)).toHaveValue("382355");
    expect(screen.getByLabelText("Latitude")).toHaveValue("23.16");
    expect(screen.getByLabelText("Longitude")).toHaveValue("72.68");
    await waitFor(() =>
      expect(screen.getByLabelText("State")).toHaveValue("Gujarat"),
    );
    // Halls are edited on the venue's page, not here.
    expect(screen.queryByLabelText("Hall name")).not.toBeInTheDocument();
  });

  it("sends only the fields that changed, then goes back to the venue's page", async () => {
    renderForm();

    await replace("City", "Surat");
    await save();

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(venueId, { city: "Surat" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/admin/venues/${venueId}`),
    );
  });

  it("does not ask the server when nothing changed", async () => {
    renderForm();

    await save();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/admin/venues/${venueId}`),
    );
    expect(api.update).not.toHaveBeenCalled();
  });

  it("clears the postal code and the map pin", async () => {
    renderForm();

    await replace(/Postal code/, "");
    await replace("Latitude", "");
    await replace("Longitude", "");
    await save();

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(venueId, {
        postalCode: null,
        latitude: null,
        longitude: null,
      }),
    );
  });

  it("checks the fields before asking the server", async () => {
    renderForm();

    await replace("Venue name", "");
    await replace("Longitude", "");
    await save();

    expect(await screen.findByText("Venue name is required")).toBeVisible();
    expect(
      screen.getByText(
        "Fill in both latitude and longitude, or leave both empty",
      ),
    ).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
  });

  it("shows why the server refused, and stays on the form", async () => {
    api.update.mockRejectedValue(
      new ApiError(
        409,
        "VENUE_EXISTS",
        "Another venue with this name already exists in this city",
      ),
    );
    renderForm();

    await replace("Venue name", "Other Centre");
    await save();

    expect(
      await screen.findByText(
        "Another venue with this name already exists in this city",
      ),
    ).toBeVisible();
    expect(screen.getByText("We couldn't save your changes")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });

  it("goes back to the venue's page on Cancel", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/admin/venues/${venueId}`,
    );
  });
});
