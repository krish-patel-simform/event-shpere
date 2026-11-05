/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import {
  eventAttendeesHref,
  eventHallsHref,
  eventHref,
  eventScheduleHref,
  eventSessionsHref,
  eventSpeakersHref,
} from "../../routes";
import { EventSectionTabs, type EventSection } from "../EventSectionTabs";

const eventId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const counts = {
  sessions: 4,
  unscheduled: 1,
  speakers: 3,
  halls: 2,
  attendees: 10,
};

function renderTabs(current: EventSection) {
  render(
    <EventSectionTabs eventId={eventId} current={current} counts={counts} />,
  );
  return within(screen.getByRole("navigation", { name: "Event sections" }));
}

describe("EventSectionTabs", () => {
  it("links every tab to its page", () => {
    const tabs = renderTabs("overview");

    expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      eventHref(eventId),
    );
    expect(tabs.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "href",
      eventSessionsHref(eventId),
    );
    expect(tabs.getByRole("link", { name: /Schedule board/ })).toHaveAttribute(
      "href",
      eventScheduleHref(eventId),
    );
    expect(tabs.getByRole("link", { name: /Speakers/ })).toHaveAttribute(
      "href",
      eventSpeakersHref(eventId),
    );
    expect(tabs.getByRole("link", { name: /Halls/ })).toHaveAttribute(
      "href",
      eventHallsHref(eventId),
    );
    expect(tabs.getByRole("link", { name: /Attendees/ })).toHaveAttribute(
      "href",
      eventAttendeesHref(eventId),
    );
  });

  it("shows the count of each tab", () => {
    const tabs = renderTabs("overview");

    expect(tabs.getByRole("link", { name: /Sessions/ })).toHaveTextContent("4");
    expect(
      tabs.getByRole("link", { name: /Schedule board/ }),
    ).toHaveTextContent("1");
    expect(tabs.getByRole("link", { name: /Attendees/ })).toHaveTextContent(
      "10",
    );
  });

  it.each([
    ["overview", "Overview"],
    ["sessions", "Sessions"],
    ["schedule", "Schedule board"],
    ["speakers", "Speakers"],
    ["halls", "Halls"],
    ["attendees", "Attendees"],
  ] as const)(
    "marks only the tab of the page being shown as current (%s)",
    (current, label) => {
      const tabs = renderTabs(current);

      const marked = tabs
        .getAllByRole("link")
        .filter((link) => link.hasAttribute("aria-current"));
      expect(marked).toHaveLength(1);
      expect(marked[0]).toHaveTextContent(label);
      expect(marked[0]).toHaveAttribute("aria-current", "page");
    },
  );

  it("shows no count on the schedule board when every session is scheduled", () => {
    render(
      <EventSectionTabs
        eventId={eventId}
        current="overview"
        counts={{ ...counts, unscheduled: 0 }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Schedule board" }),
    ).toBeInTheDocument();
  });
});
