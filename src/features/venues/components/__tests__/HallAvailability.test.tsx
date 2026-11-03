/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { venueApiService } from "../../api/venue-api.service";
import type { HallAvailabilityDto } from "../../schemas/hall-availability.schemas";
import { HallAvailability } from "../HallAvailability";

jest.mock("../../api/venue-api.service", () => ({
  venueApiService: { getHallAvailability: jest.fn() },
}));

const api = jest.mocked(venueApiService);
const venueId = "8c1f4f6e-2f4b-4c43-9a59-0d6f2a1b7e10";
const range = {
  startAt: "2026-12-12T09:00:00+05:30",
  endAt: "2026-12-12T17:00:00+05:30",
};

const hall = (
  id: string,
  name: string,
  bookedSlots: HallAvailabilityDto["bookedSlots"] = [],
): HallAvailabilityDto => ({
  id,
  name,
  capacity: 100,
  busy: bookedSlots.length > 0,
  bookedSlots,
});

const slot = (startAt: string, endAt: string) => ({ startAt, endAt });
// 10:00-12:00 IST on 12 Dec.
const morning = slot("2026-12-12T04:30:00.000Z", "2026-12-12T06:30:00.000Z");

function renderIt(props: Partial<Parameters<typeof HallAvailability>[0]> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HallAvailability
        venueId={venueId}
        range={range}
        timezone="Asia/Kolkata"
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.resetAllMocks());

describe("HallAvailability: before and while loading", () => {
  it("asks for the dates and sends nothing while there is no range", () => {
    renderIt({ range: null });

    expect(
      screen.getByText(
        "Choose the start and end dates to see which halls are free.",
      ),
    ).toBeInTheDocument();
    expect(api.getHallAvailability).not.toHaveBeenCalled();
  });

  it("shows a skeleton while the answer comes, and asks for this venue and range", () => {
    api.getHallAvailability.mockReturnValue(new Promise(() => {}));
    renderIt();

    expect(
      screen.getByRole("status", { name: "Checking which halls are free" }),
    ).toBeInTheDocument();
    expect(api.getHallAvailability).toHaveBeenCalledWith(venueId, range);
  });
});

describe("HallAvailability: the answer", () => {
  it("says how many halls are completely free and lists each hall", async () => {
    api.getHallAvailability.mockResolvedValue([
      hall("a", "Hall A"),
      hall("b", "Hall B", [morning]),
      hall("c", "Hall C"),
    ]);
    renderIt();

    expect(
      await screen.findByText(
        "2 of 3 halls are completely free on these dates.",
      ),
    ).toBeInTheDocument();
    const list = screen.getByRole("list", {
      name: "Halls and their availability",
    });
    expect(within(list).getByText("Hall A")).toBeInTheDocument();
    expect(within(list).getAllByText("100 seats")).toHaveLength(3);
    expect(
      screen.queryByText(/No hall is completely free/),
    ).not.toBeInTheDocument();
  });

  it("marks a free hall Free", async () => {
    api.getHallAvailability.mockResolvedValue([hall("a", "Hall A")]);
    renderIt();

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.queryByText("Booked")).not.toBeInTheDocument();
  });

  it("marks a partly booked hall Booked and lists WHEN, in the venue's zone", async () => {
    api.getHallAvailability.mockResolvedValue([hall("b", "Hall B", [morning])]);
    renderIt();

    expect(await screen.findByText("Booked")).toBeInTheDocument();
    expect(screen.getByText("12 Dec, 10:00–12:00")).toBeInTheDocument();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
  });

  it("uses the singular for a venue with one hall", async () => {
    api.getHallAvailability.mockResolvedValue([hall("a", "Hall A")]);
    renderIt();

    expect(
      await screen.findByText("1 of 1 hall is completely free on these dates."),
    ).toBeInTheDocument();
  });

  it("shows the first three booked times and counts the rest", async () => {
    const day = (hour: number) =>
      slot(`2026-12-12T0${hour}:00:00.000Z`, `2026-12-12T0${hour}:30:00.000Z`);
    api.getHallAvailability.mockResolvedValue([
      hall("a", "Hall A", [day(1), day(2), day(3), day(4), day(5)]),
    ]);
    renderIt();

    const booked = await screen.findByRole("list", {
      name: "Hall A is booked",
    });
    expect(within(booked).getAllByRole("listitem")).toHaveLength(4);
    expect(within(booked).getByText("+ 2 more")).toBeInTheDocument();
  });

  it("warns, without blocking, when no hall is completely free", async () => {
    api.getHallAvailability.mockResolvedValue([
      hall("a", "Hall A", [morning]),
      hall("b", "Hall B", [morning]),
    ]);
    renderIt();

    expect(
      await screen.findByText(
        "0 of 2 halls are completely free on these dates.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No hall is completely free on these dates/),
    ).toBeInTheDocument();
    expect(screen.getByText(/can still take sessions/)).toBeInTheDocument();
  });

  it("says so for a venue with no halls switched on", async () => {
    api.getHallAvailability.mockResolvedValue([]);
    renderIt();

    expect(
      await screen.findByText("This venue has no halls switched on."),
    ).toBeInTheDocument();
  });

  it("shows only times: nothing about what is booked or by whom", async () => {
    // One hall is free, so the "none free" warning (which mentions sessions) is not on screen.
    api.getHallAvailability.mockResolvedValue([
      hall("a", "Hall A"),
      hall("b", "Hall B", [morning]),
    ]);
    renderIt();

    await screen.findByText("Booked");

    expect(document.body.textContent).not.toMatch(/session|event|organizer/i);
  });
});

describe("HallAvailability: failures", () => {
  it("shows the server's reason and tries again", async () => {
    const user = userEvent.setup();
    api.getHallAvailability.mockRejectedValue(
      new ApiError(503, "SERVICE_UNAVAILABLE", "Could not check right now"),
    );
    renderIt();

    expect(
      await screen.findByText("We couldn't check the halls"),
    ).toBeInTheDocument();
    expect(screen.getByText("Could not check right now")).toBeInTheDocument();

    api.getHallAvailability.mockResolvedValue([hall("a", "Hall A")]);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("1 of 1 hall is completely free on these dates."),
    ).toBeInTheDocument();
  });

  it("does not retry a refusal (an unapproved organizer is a final answer)", async () => {
    api.getHallAvailability.mockRejectedValue(
      new ApiError(403, "ORGANIZER_NOT_VERIFIED", "Waiting for admin approval"),
    );
    renderIt();

    expect(
      await screen.findByText("Waiting for admin approval"),
    ).toBeInTheDocument();
    expect(api.getHallAvailability).toHaveBeenCalledTimes(1);
  });
});
