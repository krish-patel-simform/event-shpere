/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { stateApiService } from "@/src/features/locations/api/state-api.service";
import { giftCity, venueId } from "../../__fixtures__/venues";
import { venueApiService } from "../../api/venue-api.service";
import { CreateVenueForm } from "../CreateVenueForm";

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

jest.mock("@/src/features/locations/api/state-api.service", () => ({
  stateApiService: { list: jest.fn() },
}));
const statesApi = jest.mocked(stateApiService);

const gujaratId = "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b";
const states = [
  { id: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", name: "Goa", code: "IN-GA" },
  { id: gujaratId, name: "Gujarat", code: "IN-GJ" },
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
      <CreateVenueForm />
    </QueryClientProvider>,
  );
}

const type = (label: string | RegExp, text: string, index = 0) =>
  userEvent.type(screen.getAllByLabelText(label)[index], text);

/** Fills the venue details and the first hall: the smallest form the server accepts. */
async function fillMinimum() {
  await type("Venue name", "GIFT City Convention Centre");
  await type("Address", "Block 12, Zone 1, GIFT City");
  await type("City", "Gandhinagar");
  await pickState("Gujarat");
  await type("Hall name", "Main Auditorium");
  await type("Seats", "300");
}

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Create venue" }));

/** Picks a state by its name once the list has loaded: open the list, then click the row. */
async function pickState(name: string) {
  await waitFor(() => expect(screen.getByLabelText("State")).toBeEnabled());
  await userEvent.click(screen.getByLabelText("State"));
  await userEvent.click(
    await screen.findByRole("option", { name: new RegExp(`^${name}`) }),
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  statesApi.list.mockResolvedValue(states);
});

describe("CreateVenueForm", () => {
  it("shows India and its time zone as fixed fields, with a note that only India is supported", () => {
    renderForm();

    expect(screen.getByLabelText("Country")).toHaveValue("IN");
    expect(screen.getByLabelText("Country")).toBeDisabled();
    expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Kolkata");
    expect(screen.getByLabelText("Time zone")).toBeDisabled();
    expect(
      screen.getByText("Venues can only be added in India for now."),
    ).toBeInTheDocument();
  });

  it("starts with one empty hall that cannot be removed", () => {
    renderForm();

    expect(screen.getAllByLabelText("Hall name")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove hall 1" }),
    ).toBeDisabled();
  });

  it("lists the states by name, and says so when they cannot be loaded", async () => {
    statesApi.list.mockRejectedValueOnce(new Error("offline"));
    renderForm();

    expect(await screen.findByText(/Could not load the states/)).toBeVisible();
    expect(screen.getByLabelText("State")).toBeDisabled();

    // "Try again" asks again, and the names appear.
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByLabelText("State")).toBeEnabled());
    await userEvent.click(screen.getByLabelText("State"));
    expect(
      await screen.findByRole("option", { name: /^Gujarat/ }),
    ).toBeVisible();
  });

  it("searches the states as you type, by name or by code", async () => {
    renderForm();
    // By role: while the list is open it is labelled "State" too, so the label text matches twice.
    const field = () => screen.getByRole("combobox", { name: "State" });
    await waitFor(() => expect(field()).toBeEnabled());
    const rows = () =>
      screen.getAllByRole("option").map((option) => option.textContent);

    await userEvent.click(field());
    await userEvent.type(field(), "guj");
    expect(rows()).toEqual(["GujaratGJ"]);

    await userEvent.clear(field());
    // "gj" is only Gujarat's code; it is not in the name.
    await userEvent.type(field(), "gj");
    expect(rows()).toEqual(["GujaratGJ"]);

    await userEvent.clear(field());
    await userEvent.type(field(), "ga");
    expect(rows()).toEqual(["GoaGA"]);
  });

  it("keeps the chosen state's name in the field", async () => {
    renderForm();

    await pickState("Gujarat");

    expect(screen.getByLabelText("State")).toHaveValue("Gujarat");
  });

  it("asks for the required fields and sends nothing", async () => {
    renderForm();

    await submit();

    expect(
      await screen.findByText("Venue name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
    expect(screen.getByText("Select a state")).toBeInTheDocument();
    expect(screen.getByText("Hall name is required")).toBeInTheDocument();
    expect(screen.getByText("Seats are required")).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("sends the body the API takes, then opens the new venue's page", async () => {
    api.create.mockResolvedValue({
      ...giftCity,
      id: venueId,
      createdAt: "2026-10-30T10:00:00.000Z",
    });
    renderForm();

    await fillMinimum();
    await type("Latitude", "23.16");
    await type("Longitude", "72.68");
    await userEvent.click(
      screen.getByRole("button", { name: "Add another hall" }),
    );
    await type("Hall name", "Workshop Room 1", 1);
    await type("Seats", "80", 1);
    await submit();

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0][0]).toEqual({
      name: "GIFT City Convention Centre",
      addressLine: "Block 12, Zone 1, GIFT City",
      city: "Gandhinagar",
      state: "Gujarat",
      postalCode: undefined,
      country: "IN",
      timezone: "Asia/Kolkata",
      latitude: 23.16,
      longitude: 72.68,
      halls: [
        { name: "Main Auditorium", capacity: 300 },
        { name: "Workshop Room 1", capacity: 80 },
      ],
    });
    await screen.findByRole("button", { name: "Create venue" });
    expect(push).toHaveBeenCalledWith(`/admin/venues/${venueId}`);
  });

  it("highlights the hall that repeats a name, ignoring case", async () => {
    renderForm();

    await fillMinimum();
    await userEvent.click(
      screen.getByRole("button", { name: "Add another hall" }),
    );
    await type("Hall name", "main auditorium", 1);
    await type("Seats", "50", 1);
    await submit();

    const repeated = (await screen.findAllByLabelText("Hall name"))[1];
    expect(repeated).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Hall names must be unique within the venue"),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("removes a hall row, but never the last one", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Add another hall" }),
    );
    expect(screen.getAllByLabelText("Hall name")).toHaveLength(2);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove hall 2" }),
    );

    expect(screen.getAllByLabelText("Hall name")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove hall 1" }),
    ).toBeDisabled();
  });

  it("needs both map coordinates or neither", async () => {
    renderForm();

    await fillMinimum();
    await type("Latitude", "23.16");
    await submit();

    expect(
      await screen.findByText(/both latitude and longitude/),
    ).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("shows the server's message when the venue already exists, and stays on the form", async () => {
    api.create.mockRejectedValue(
      new ApiError(
        409,
        "VENUE_EXISTS",
        'A venue named "GIFT City Convention Centre" already exists in Gandhinagar',
      ),
    );
    renderForm();

    await fillMinimum();
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't add this venue");
    expect(alert).toHaveTextContent("already exists in Gandhinagar");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Venue name")).toHaveValue(
      "GIFT City Convention Centre",
    );
  });
});
