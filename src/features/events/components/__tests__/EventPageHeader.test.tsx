/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import {
  findSampleOverview,
  FINTECH_ID,
} from "../../__fixtures__/event-manage";
import { eventHref, EVENT_ROUTES } from "../../routes";
import type { EventOverviewData } from "../../types/event-manage.types";
import { venueLine } from "../../utils/event-display";
import { EventPageHeader } from "../EventPageHeader";

function overview(): EventOverviewData {
  const found = findSampleOverview(FINTECH_ID);
  if (!found) throw new Error("no sample overview");
  return found;
}

describe("EventPageHeader", () => {
  it("shows the title, status, dates and venue, and its section tabs", () => {
    const data = overview();
    render(<EventPageHeader overview={data} current="overview" />);

    expect(
      screen.getByRole("heading", { level: 1, name: data.event.title }),
    ).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(venueLine(data.event))).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Event sections" }),
    ).toBeInTheDocument();
  });

  it("ends the breadcrumb at the event on the overview", () => {
    const data = overview();
    render(<EventPageHeader overview={data} current="overview" />);

    const trail = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(trail.getByRole("link", { name: "My events" })).toHaveAttribute(
      "href",
      EVENT_ROUTES.list,
    );
    expect(trail.getByText(data.event.title)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links back to the event and ends at Sessions on the sessions page", () => {
    const data = overview();
    render(<EventPageHeader overview={data} current="sessions" />);

    const trail = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(trail.getByRole("link", { name: data.event.title })).toHaveAttribute(
      "href",
      eventHref(data.event.id),
    );
    expect(trail.getByText("Sessions")).toHaveAttribute("aria-current", "page");
  });

  it.each([
    ["schedule", "Schedule board"],
    ["speakers", "Speakers"],
    ["halls", "Halls"],
    ["attendees", "Attendees"],
  ] as const)("ends the breadcrumb at %s on its page", (current, label) => {
    render(<EventPageHeader overview={overview()} current={current} />);

    const trail = within(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    );
    expect(trail.getByText(label)).toHaveAttribute("aria-current", "page");
  });

  it("shows the buttons the page passes in", () => {
    render(
      <EventPageHeader
        overview={overview()}
        current="sessions"
        actions={<button type="button">Add session</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add session" }),
    ).toBeInTheDocument();
  });

  it("shows no buttons when the page passes none", () => {
    render(<EventPageHeader overview={overview()} current="sessions" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
