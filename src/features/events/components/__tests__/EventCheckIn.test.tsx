/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import { findSampleOverview, SUMMIT_ID } from "../../__fixtures__/event-manage";
import { useHasPermission } from "@/src/features/auth";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { EventCheckIn } from "../EventCheckIn";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
const api = jest.mocked(eventApiService);

// The door itself (route 6) has its own tests in the registrations feature: here it only has to
// receive the event, so it is a stub that shows what it was given.
jest.mock("@/src/features/registrations", () => ({
  EventCheckInDesk: ({
    event,
  }: {
    event: {
      id: string;
      startAt: string;
      endAt: string;
      timezone: string;
      status: string;
    };
  }) => (
    <p>
      Door: {event.id} · {event.startAt} · {event.endAt} · {event.timezone} ·{" "}
      {event.status}
    </p>
  ),
}));

function show(eventId: string) {
  const overview = findSampleOverview(eventId);
  if (!overview) throw new Error("no sample overview");
  api.getOverview.mockResolvedValue(overview);
  renderWithClient(<EventCheckIn eventId={eventId} />);
  return overview;
}

// The organizer is looking (the header's breadcrumb reads the permission).
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const hasPermission = jest.mocked(useHasPermission);

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockReturnValue(true);
});

describe("EventCheckIn", () => {
  it("marks the Check-in tab as current", async () => {
    show(SUMMIT_ID);
    await screen.findByRole("heading", { level: 1 });

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: "Check-in" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Check-in" }),
    ).toBeInTheDocument();
  });

  it("hands the door the event's id, dates, zone and status", async () => {
    const { event } = show(SUMMIT_ID);

    expect(
      await screen.findByText(
        `Door: ${SUMMIT_ID} · ${event.startAt} · ${event.endAt} · ${event.timezone} · ${event.status}`,
      ),
    ).toBeInTheDocument();
  });
});
