/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PermissionCode } from "@/src/core/auth/permission-catalog";
import { useHasAnyPermission, useHasPermission } from "@/src/features/auth";
import {
  allNotifications,
  coSpeakerAccepted,
  NOW,
  personalNotifications,
  sessionConfirmed,
} from "../../__fixtures__/notifications";
import type { NotificationDto } from "../../schemas/notification.schema";
import { Notifications } from "../Notifications";

// Only the permission hooks are replaced; the rest of the auth barrel is the real one.
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
  useHasAnyPermission: jest.fn(),
}));
const hasPermission = jest.mocked(useHasPermission);
const hasAnyPermission = jest.mocked(useHasAnyPermission);

/** `platform`: may act on the platform (admin). `manage`: may change notification preferences. */
function givenPermissions({
  platform = false,
  manage = true,
}: { platform?: boolean; manage?: boolean } = {}) {
  hasAnyPermission.mockReturnValue(platform);
  hasPermission.mockImplementation(
    (code: PermissionCode) => code === "NOTIFICATION_MANAGE" && manage,
  );
}

function renderPage(
  props: { initialNotifications?: readonly NotificationDto[] } = {},
) {
  return render(
    <Notifications
      initialNotifications={allNotifications}
      now={NOW}
      {...props}
    />,
  );
}

const items = () => screen.getAllByRole("listitem");

beforeEach(() => {
  givenPermissions({ platform: true });
});

describe("Notifications list", () => {
  it("groups by day under headings, newest first", () => {
    renderPage();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.slice(0, 4)).toEqual([
      "Today",
      "Yesterday",
      "Earlier this week",
      "Earlier",
    ]);

    const today = screen.getByRole("region", { name: "Today" });
    const todayItems = within(today).getAllByRole("listitem");
    expect(todayItems).toHaveLength(2);
    expect(todayItems[0]).toHaveTextContent("Your session was confirmed.");
    expect(todayItems[1]).toHaveTextContent("New organizer application.");
  });

  it("shows how long ago each came", () => {
    renderPage();
    // Two notifications came 2 hours ago (10:00 and 09:30 are both "2 hours" before 12:00).
    expect(screen.getAllByText("2 hours ago")).toHaveLength(2);
    expect(screen.getByText("Yesterday at 16:20")).toBeInTheDocument();
    expect(screen.getByText("14 Oct 2026 at 09:12")).toBeInTheDocument();
  });

  it("marks unread ones with the word Unread, not colour alone", () => {
    renderPage();
    const unreadItems = items().filter((item) =>
      within(item).queryByText("Unread"),
    );
    expect(unreadItems).toHaveLength(2);
    expect(screen.getByText("2 unread notifications")).toBeInTheDocument();
  });

  it("links to what a notification is about", () => {
    renderPage();
    expect(
      screen.getByRole("link", { name: "Review application" }),
    ).toHaveAttribute("href", "/admin/organizers");
  });
});

describe("filters", () => {
  it("has All and Unread tabs, an unread count, and the topics present", () => {
    renderPage();
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([
      "All",
      "Unread2",
      "Sessions",
      "Approvals",
      "Users",
      "System",
    ]);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("Unread shows only the unread notifications", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(items()).toHaveLength(2);
    expect(screen.queryByText("Vikram Mehta")).not.toBeInTheDocument();
  });

  it("a topic shows only that category", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Sessions" }));
    expect(items()).toHaveLength(2);
    expect(screen.getByText("Vikram Mehta")).toBeInTheDocument();
    expect(
      screen.queryByText("New organizer application."),
    ).not.toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderPage();
    screen.getByRole("tab", { name: "All" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Unread/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("marking as read", () => {
  it("marks one notification as read", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", {
        name: "Mark as read: Your session was confirmed.",
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Mark as read: Your session was confirmed.",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Unread/ })).toHaveTextContent("1");
  });

  it("a read notification has no Mark as read button", () => {
    renderPage({ initialNotifications: [coSpeakerAccepted] });
    expect(
      screen.queryByRole("button", { name: /Mark as read/ }),
    ).not.toBeInTheDocument();
  });

  it("marks everything as read, then disables the button", async () => {
    const user = userEvent.setup();
    renderPage();
    const markAll = screen.getByRole("button", { name: "Mark all as read" });
    expect(markAll).toBeEnabled();
    await user.click(markAll);
    expect(
      within(screen.getByRole("tabpanel")).queryByText("Unread"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(markAll).toBeDisabled();
  });

  it("an item read in the Unread tab leaves that tab", async () => {
    const user = userEvent.setup();
    renderPage({ initialNotifications: [sessionConfirmed, coSpeakerAccepted] });
    await user.click(screen.getByRole("tab", { name: /Unread/ }));
    await user.click(screen.getByRole("button", { name: /Mark as read/ }));
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });
});

describe("empty and other states", () => {
  it("shows an empty state when there are no notifications", () => {
    renderPage({ initialNotifications: [] });
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
  });

  it("shows a different empty state in Unread when all are read", async () => {
    const user = userEvent.setup();
    renderPage({ initialNotifications: [coSpeakerAccepted] });
    await user.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(
      screen.getByText("There are no unread notifications."),
    ).toBeInTheDocument();
  });

  it("shows a loading skeleton", () => {
    render(<Notifications status="loading" />);
    expect(
      screen.getByRole("status", { name: "Loading notifications" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark all as read" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<Notifications status="error" onRetry={onRetry} />);
    expect(
      screen.getByText("We couldn't load your notifications"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("permissions", () => {
  it("hides platform-wide notifications and topics without platform rights", () => {
    givenPermissions({ platform: false });
    renderPage();
    expect(
      screen.queryByText("New organizer application."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Dev Verma was suspended"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Approvals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Users" }),
    ).not.toBeInTheDocument();
    expect(items()).toHaveLength(personalNotifications.length);
    // Only the personal unread one counts.
    expect(screen.getByText("1 unread notification")).toBeInTheDocument();
  });

  it("shows platform-wide notifications and topics with platform rights", () => {
    renderPage();
    expect(screen.getByText("New organizer application.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Approvals" })).toBeInTheDocument();
  });

  it("shows the preferences, marked as not available yet, with NOTIFICATION_MANAGE", () => {
    renderPage();
    const card = screen.getByRole("region", { name: "Delivery preferences" });
    expect(within(card).getByText("Not available yet")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Save preferences" }),
    ).toBeDisabled();
    expect(
      within(card).getByRole("group", { name: "A new organizer applies" }),
    ).toBeInTheDocument();
  });

  it("leaves the platform preferences out without platform rights", () => {
    givenPermissions({ platform: false });
    renderPage();
    const card = screen.getByRole("region", { name: "Delivery preferences" });
    expect(
      within(card).getByRole("group", { name: "Session status changes" }),
    ).toBeInTheDocument();
    expect(
      within(card).queryByRole("group", { name: "A new organizer applies" }),
    ).not.toBeInTheDocument();
  });

  it("hides the preferences without NOTIFICATION_MANAGE", () => {
    givenPermissions({ platform: true, manage: false });
    renderPage();
    expect(
      screen.queryByRole("region", { name: "Delivery preferences" }),
    ).not.toBeInTheDocument();
  });
});
