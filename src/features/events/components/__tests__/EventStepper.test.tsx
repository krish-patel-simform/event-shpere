/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { eventEditHref } from "../../routes";
import { EventStepper } from "../EventStepper";

const eventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";

describe("EventStepper: a new event", () => {
  it("shows the three steps, with only the first one current and the others locked", () => {
    render(<EventStepper current="details" />);

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent("Details");
    expect(steps[1]).toHaveTextContent("Content");
    expect(steps[2]).toHaveTextContent("Media");

    expect(
      screen.getByText(/^Details/, { selector: "span" }),
    ).toBeInTheDocument();
    // Nothing to link to yet: no step is a link.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(steps[0].firstElementChild).toHaveAttribute("aria-current", "step");
    expect(steps[1].firstElementChild).toHaveAttribute("aria-disabled", "true");
    expect(steps[2].firstElementChild).toHaveAttribute("aria-disabled", "true");
    expect(steps[1]).toHaveTextContent("locked until the event is created");
  });

  it("does not lock the current step", () => {
    render(<EventStepper current="details" />);

    expect(
      screen.getAllByRole("listitem")[0].firstElementChild,
    ).not.toHaveAttribute("aria-disabled");
  });
});

describe("EventStepper: a saved event", () => {
  it("links every step to its address", () => {
    render(<EventStepper eventId={eventId} current="content" />);

    expect(screen.getByRole("link", { name: /^Details/ })).toHaveAttribute(
      "href",
      eventEditHref(eventId),
    );
    expect(screen.getByRole("link", { name: /^Content/ })).toHaveAttribute(
      "href",
      eventEditHref(eventId, "content"),
    );
    expect(screen.getByRole("link", { name: /^Media/ })).toHaveAttribute(
      "href",
      eventEditHref(eventId, "media"),
    );
  });

  it("marks only the current step with aria-current", () => {
    render(<EventStepper eventId={eventId} current="media" />);

    expect(screen.getByRole("link", { name: /^Media/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("link", { name: /^Details/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("says which steps are done, for screen readers", () => {
    render(
      <EventStepper
        eventId={eventId}
        current="details"
        done={{ details: true, content: true, media: false }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /^Content.*\(done\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Media/ })).not.toHaveTextContent(
      "(done)",
    );
  });
});
