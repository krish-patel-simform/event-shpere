/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { findSampleOverview, SUMMIT_ID } from "../../__fixtures__/event-manage";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { eventSessionNewHref } from "../../routes";
import { EventSchedule } from "../EventSchedule";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getOverview: jest.fn() },
}));
const api = jest.mocked(eventApiService);

beforeEach(() => {
  jest.resetAllMocks();
  const overview = findSampleOverview(SUMMIT_ID);
  if (!overview) throw new Error("no sample overview");
  api.getOverview.mockResolvedValue(overview);
});

async function renderBoard() {
  renderWithClient(<EventSchedule eventId={SUMMIT_ID} />);
  await screen.findByRole("heading", { level: 1 });
}

describe("EventSchedule", () => {
  it("shows the event's header with the Schedule board tab as current", async () => {
    await renderBoard();

    const tabs = within(
      screen.getByRole("navigation", { name: "Event sections" }),
    );
    expect(tabs.getByRole("link", { name: /Schedule board/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("says it is sample data, with a Static badge", async () => {
    await renderBoard();

    const notice = within(screen.getByText("Sample data").closest("div")!);
    expect(notice.getByText("Static")).toBeInTheDocument();
  });

  it("lists the sessions that still need a hall and a time, with a way to create one", async () => {
    await renderBoard();

    const card = within(
      screen
        .getByRole("heading", { name: "Not scheduled (2)" })
        .closest("section")!,
    );
    expect(card.getByText("Platform Teams at Scale")).toBeInTheDocument();
    expect(card.getByText("Design Tokens in Practice")).toBeInTheDocument();
    expect(card.getByText(/No speaker yet · ₹500/)).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Create session" })).toHaveAttribute(
      "href",
      eventSessionNewHref(SUMMIT_ID),
    );
  });

  it("has one tab per day of the event, the first one open", async () => {
    await renderBoard();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Thu 3 Dec",
      "Fri 4 Dec",
      "Sat 5 Dec",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("draws one column per hall, each with its own sessions", async () => {
    await renderBoard();

    const main = within(
      screen.getByRole("list", { name: "Main Hall, Thu 3 Dec" }),
    );
    expect(
      main.getByText("Opening Keynote: The State of Product Engineering"),
    ).toBeInTheDocument();
    expect(main.getByText(/09:30–10:30 · Meera Joshi/)).toBeInTheDocument();
    expect(
      main.queryByText("Edge Rendering Explained"),
    ).not.toBeInTheDocument();

    const hallB = within(
      screen.getByRole("list", { name: "Hall B, Thu 3 Dec" }),
    );
    expect(hallB.getByText("Edge Rendering Explained")).toBeInTheDocument();
  });

  it("shows a cancelled session struck through and marked", async () => {
    await renderBoard();

    const hallB = within(
      screen.getByRole("list", { name: "Hall B, Thu 3 Dec" }),
    );
    expect(hallB.getByText("Micro-frontends in Practice")).toHaveClass(
      "line-through",
    );
    expect(hallB.getByText(/Cancelled/)).toBeInTheDocument();
  });

  it("shows how full a workshop is", async () => {
    await renderBoard();

    expect(screen.getByText(/60 of 60 · full/)).toBeInTheDocument();
  });

  it("shows another day when its tab is chosen", async () => {
    const user = userEvent.setup();
    await renderBoard();

    await user.click(screen.getByRole("tab", { name: "Fri 4 Dec" }));

    expect(screen.getByRole("tab", { name: "Fri 4 Dec" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.queryByText("Edge Rendering Explained"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Nothing is placed on Fri 4 Dec yet."),
    ).toBeInTheDocument();
  });

  it("says dragging is not built yet instead of offering it", async () => {
    await renderBoard();

    expect(
      screen.getByText(
        /Dragging a card onto a hall and a time is not built yet/,
      ),
    ).toBeInTheDocument();
  });
});

describe("EventSchedule: loading the event", () => {
  it("shows a skeleton while the event loads", () => {
    api.getOverview.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventSchedule eventId={SUMMIT_ID} />);

    expect(
      screen.getByRole("status", { name: "Loading event" }),
    ).toBeInTheDocument();
  });

  it("says so when the event is not found", async () => {
    api.getOverview.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "No such event"),
    );
    renderWithClient(<EventSchedule eventId={SUMMIT_ID} />);

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
  });
});
