/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getInitials } from "@/src/core/ui";
import { DashboardShell } from "../DashboardShell";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

const user = { name: "Ananya Rao", roleLabel: "Attendee · organizer pending" };

// jsdom does not implement <dialog>.showModal()/close(): a minimal stand-in that sets `open`.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  mockPathname = "/dashboard";
});

describe("getInitials", () => {
  it.each([
    ["Ananya Rao", "AR"],
    ["  ananya   kumar rao ", "AR"],
    ["Ananya", "A"],
    ["", ""],
  ])("%j -> %j", (name, initials) => expect(getInitials(name)).toBe(initials));
});

describe("DashboardShell", () => {
  it("shows the user, the page content, search and notifications", () => {
    render(
      <DashboardShell user={user}>
        <p>Page content</p>
      </DashboardShell>,
    );

    expect(screen.getAllByText("Ananya Rao").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Attendee · organizer pending").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    // The bell in the top bar (the side menu has a "Notifications" link too).
    expect(
      within(screen.getByRole("banner")).getByRole("link", {
        name: "Notifications",
      }),
    ).toHaveAttribute("href", "/notifications");
  });

  it("marks only the current page in the menu", () => {
    render(<DashboardShell user={user}>x</DashboardShell>);

    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Browse events" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("log out is shown but not available yet", () => {
    render(<DashboardShell user={user}>x</DashboardShell>);
    expect(
      screen.getAllByRole("button", {
        name: "Log out (coming soon)",
        hidden: true,
      })[0],
    ).toBeDisabled();
  });

  it("opens the menu drawer from the menu button and closes it after choosing a page", async () => {
    render(<DashboardShell user={user}>x</DashboardShell>);
    // A closed dialog is hidden, and hidden elements have no accessible name: query by role only.
    const drawer = screen.getByRole("dialog", { hidden: true });
    expect(drawer).toHaveAttribute("aria-label", "Menu");
    expect(drawer).not.toHaveAttribute("open");

    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(drawer).toHaveAttribute("open");

    const link = within(drawer).getByRole("link", {
      name: "Speakers",
      hidden: true,
    });
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);
    expect(drawer).not.toHaveAttribute("open");
  });
});
