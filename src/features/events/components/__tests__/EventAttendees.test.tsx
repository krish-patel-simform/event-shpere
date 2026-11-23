/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import {
  FINTECH_ID,
  findSampleOverview,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";
import { useHasPermission } from "@/src/features/auth";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { EventAttendees } from "../EventAttendees";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
const api = jest.mocked(eventApiService);

// The list itself (route 5) has its own tests in the registrations feature: here it only has to
// receive the event, so it is a stub that shows what it was given.
jest.mock("@/src/features/registrations", () => ({
  EventAttendeeList: ({
    event,
  }: {
    event: {
      id: string;
      startAt: string;
      endAt: string;
      timezone: string;
      capacity: number | null;
    };
  }) => (
    <p>
      Attendee list: {event.id} · {event.startAt} · {event.endAt} ·{" "}
      {event.timezone} · {String(event.capacity)}
    </p>
  ),
}));

function show(eventId: string) {
  const overview = findSampleOverview(eventId);
  if (!overview) throw new Error("no sample overview");
  api.getOverview.mockResolvedValue(overview);
  renderWithClient(<EventAttendees eventId={eventId} />);
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

describe("EventAttendees", () => {
  it("marks the Registrations tab as current, with no sample-data notice any more", async () => {
    show(SUMMIT_ID);
    await screen.findByRole("heading", { level: 1 });

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Registrations/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Sample data")).toBeNull();
    expect(screen.queryByText("Static")).toBeNull();
  });

  it("hands the list the event's id, dates, zone and capacity", async () => {
    show(SUMMIT_ID);

    expect(
      await screen.findByText(
        `Attendee list: ${SUMMIT_ID} · 2026-12-03T03:30:00.000Z · 2026-12-05T12:30:00.000Z · Asia/Kolkata · 600`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Registrations" }),
    ).toBeInTheDocument();
  });

  it("says nobody can register a draft yet, and still shows the (empty) list", async () => {
    show(FINTECH_ID);

    expect(
      await screen.findByText("Nobody can register yet"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Attendee list:/)).toBeInTheDocument();
  });

  it("says nothing about drafts for a published event", async () => {
    show(SUMMIT_ID);
    await screen.findByText(/Attendee list:/);

    expect(screen.queryByText("Nobody can register yet")).toBeNull();
  });
});
