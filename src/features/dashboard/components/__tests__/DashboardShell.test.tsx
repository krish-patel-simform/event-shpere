/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getInitials } from "@/src/core/ui";
import { DashboardShell } from "../DashboardShell";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

const user = { name: "Ananya Rao", roleLabel: "Attendee · organizer pending" };
// The logout props when nothing is happening: not logging out, nothing failed.
const idle = {
  onLogout: jest.fn(),
  isLoggingOut: false,
  logoutFailed: false,
};

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
      <DashboardShell user={user} {...idle}>
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
    render(
      <DashboardShell user={user} {...idle}>
        x
      </DashboardShell>,
    );

    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Browse events" }),
    ).not.toHaveAttribute("aria-current");
  });

  describe("log out", () => {
    // The side menu is rendered twice (desktop and drawer), so there are two buttons.
    const logOutButtons = () =>
      screen.getAllByRole("button", { name: "Log out", hidden: true });

    it("calls onLogout when the button is clicked", async () => {
      const onLogout = jest.fn();
      render(
        <DashboardShell user={user} {...idle} onLogout={onLogout}>
          x
        </DashboardShell>,
      );

      await userEvent.click(logOutButtons()[0]);

      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it("is enabled and quiet when idle", () => {
      render(
        <DashboardShell user={user} {...idle}>
          x
        </DashboardShell>,
      );

      for (const button of logOutButtons()) expect(button).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is disabled and busy while logging out, so it cannot be sent twice", () => {
      render(
        <DashboardShell user={user} {...idle} isLoggingOut>
          x
        </DashboardShell>,
      );

      for (const button of logOutButtons()) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
      }
    });

    it("tells the user they are still signed in when logging out failed", () => {
      render(
        <DashboardShell user={user} {...idle} logoutFailed>
          Page content
        </DashboardShell>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("We couldn't log you out");
      expect(alert).toHaveTextContent("still signed in");
      expect(screen.getByText("Page content")).toBeInTheDocument();
      for (const button of logOutButtons()) expect(button).toBeEnabled();
    });
  });

  it("opens the menu drawer from the menu button and closes it after choosing a page", async () => {
    render(
      <DashboardShell user={user} {...idle}>
        x
      </DashboardShell>,
    );
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
