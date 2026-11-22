/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { EVENT_ROUTES } from "@/src/features/events";
import { ADMIN_SESSIONS_SAMPLE } from "../../sample/admin-sessions-sample";
import { ManageSessions } from "../ManageSessions";

describe("ManageSessions (admin, Static until an API lists every session)", () => {
  it("says plainly that the rows are samples, and links to Manage events for the real sessions", () => {
    render(<ManageSessions />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Manage sessions" }),
    ).toBeInTheDocument();
    // An info notice is announced politely (role="status").
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Sample data");
    expect(notice).toHaveTextContent("Static");
    expect(
      within(notice).getByRole("link", { name: "Manage events" }),
    ).toHaveAttribute("href", EVENT_ROUTES.manage);
  });

  it("switches every filter and Export CSV off", () => {
    render(<ManageSessions />);

    for (const name of ["Status", "Event", "Organizer", "Format", "Type"]) {
      expect(screen.getByRole("combobox", { name })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("shows one row per sample session, and no row is a link (their ids are not real)", () => {
    render(<ManageSessions />);
    const table = screen.getByRole("table", {
      name: "Sample sessions from every event (static)",
    });

    expect(within(table).getAllByRole("row")).toHaveLength(
      ADMIN_SESSIONS_SAMPLE.length + 1,
    );
    expect(within(table).queryAllByRole("link")).toHaveLength(0);
  });

  it("marks a full session, and shows a draft as not placed and not scheduled", () => {
    render(<ManageSessions />);

    const workshop = screen.getByText("Cloud Native Basics").closest("tr")!;
    expect(within(workshop).getByText("Full")).toBeInTheDocument();
    expect(
      within(workshop).getByText("Workshop · In person"),
    ).toBeInTheDocument();

    const draft = screen
      .getByText("Observability for Frontend Teams")
      .closest("tr")!;
    expect(within(draft).getByText("Not placed")).toBeInTheDocument();
    expect(within(draft).getByText("Not scheduled")).toBeInTheDocument();
    expect(within(draft).getByText("Draft")).toBeInTheDocument();
  });
});
