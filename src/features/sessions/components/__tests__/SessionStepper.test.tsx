/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { eventSessionEditHref, type SessionStep } from "../../routes";
import { SessionStepper } from "../SessionStepper";

const eventId = "3f2b8a10-6c4d-4e57-8b19-0a1d2c3e4f01";
const sessionId = "7c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e01";

function renderSteps(
  props: Partial<Parameters<typeof SessionStepper>[0]> & {
    current: SessionStep;
  },
) {
  render(<SessionStepper eventId={eventId} {...props} />);
  return within(screen.getByRole("navigation", { name: "Session steps" }));
}

describe("SessionStepper: a saved session", () => {
  it("has three steps, each a link to its page, and no separate speakers step", () => {
    const steps = renderSteps({ sessionId, current: "content" });

    expect(
      steps.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(
      (["details", "content", "cover"] as const).map((step) =>
        eventSessionEditHref(eventId, sessionId, step),
      ),
    );
    expect(
      steps.queryByRole("link", { name: /^Speakers/ }),
    ).not.toBeInTheDocument();
  });

  it("marks only the current step", () => {
    const steps = renderSteps({ sessionId, current: "cover" });

    const marked = steps
      .getAllByRole("link")
      .filter((link) => link.hasAttribute("aria-current"));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("Cover");
  });

  it("ticks the steps that are done, but not the current one", () => {
    const steps = renderSteps({
      sessionId,
      current: "content",
      done: { details: true, content: true },
    });

    expect(steps.getByRole("link", { name: /Details/ })).toHaveTextContent(
      "(done)",
    );
    expect(steps.getByRole("link", { name: /Cover/ })).not.toHaveTextContent(
      "(done)",
    );
  });
});

describe("SessionStepper: a new session (the add page)", () => {
  it("shows the same three steps as editing", () => {
    const steps = renderSteps({ current: "details" });

    expect(steps.getAllByRole("listitem")).toHaveLength(3);
    for (const label of ["Details", "Content", "Cover"]) {
      expect(steps.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks the details as the current step", () => {
    const steps = renderSteps({ current: "details" });

    expect(
      steps.getByText("Details").closest("[aria-current]"),
    ).toHaveAttribute("aria-current", "step");
  });

  it("locks the content and the cover until the session is added: shown, not links", () => {
    const steps = renderSteps({ current: "details" });

    for (const label of ["Content", "Cover"]) {
      const locked = steps.getByText(label).closest("[aria-disabled]");
      expect(locked).toHaveAttribute("aria-disabled", "true");
      expect(locked).toHaveAttribute("title", "Add the session first");
      expect(locked?.tagName).not.toBe("A");
    }
    expect(
      steps.queryByRole("link", { name: /Content/ }),
    ).not.toBeInTheDocument();
    expect(
      steps.queryByRole("link", { name: /Cover/ }),
    ).not.toBeInTheDocument();
    expect(steps.getByText("Content").parentElement).toHaveTextContent(
      "locked until the session is added",
    );
  });

  it("says on the Details step that it holds the speakers too", () => {
    const steps = renderSteps({ current: "details" });

    expect(steps.getByText("Time, hall, speakers, price")).toBeInTheDocument();
  });
});
