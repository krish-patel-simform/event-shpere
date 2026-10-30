/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
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
  await type("Hall name", "Main Auditorium");
  await type("Seats", "300");
}

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Create venue" }));

beforeEach(() => {
  jest.resetAllMocks();
});

describe("CreateVenueForm", () => {
  it("starts with India, its time zone and one empty hall", () => {
    renderForm();

    expect(screen.getByLabelText("Country code")).toHaveValue("IN");
    expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Kolkata");
    expect(screen.getAllByLabelText("Hall name")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Remove hall 1" }),
    ).toBeDisabled();
  });

  it("asks for the required fields and sends nothing", async () => {
    renderForm();

    await submit();

    expect(
      await screen.findByText("Venue name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Address is required")).toBeInTheDocument();
    expect(screen.getByText("City is required")).toBeInTheDocument();
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
    await type(/^State/, "Gujarat");
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
