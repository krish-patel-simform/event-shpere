/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ADMIN_USERS_SAMPLE } from "../../utils/admin-users.sample";
import { AdminUsers } from "../admin/AdminUsers";

const [, , rahul, , meera, , dev, vikram] =
  ADMIN_USERS_SAMPLE.users;

function renderPage() {
  const handlers = {
    onInvite: jest.fn(),
    onChangeRole: jest.fn(),
    onSuspend: jest.fn(),
    onReactivate: jest.fn(),
    onResendSetup: jest.fn(),
    onPageChange: jest.fn(),
  };
  render(<AdminUsers data={ADMIN_USERS_SAMPLE} {...handlers} />);
  return handlers;
}

const rows = () => screen.getAllByRole("row").slice(1);
const row = (name: RegExp) => screen.getByRole("row", { name });
const openMenu = (name: string) =>
  userEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));

describe("AdminUsers: list", () => {
  it("shows each account with role, email status, account status, joined and last active", () => {
    renderPage();
    const first = row(/Ananya Rao/);

    expect(
      within(first).getByText("ananya.rao@example.com"),
    ).toBeInTheDocument();
    expect(within(first).getByText("Organizer pending")).toBeInTheDocument();
    expect(within(first).getByText("Verified")).toBeInTheDocument();
    expect(within(first).getByText("Active")).toBeInTheDocument();
    expect(within(first).getByText("20 Oct 2026")).toBeInTheDocument();
    expect(within(first).getByText("3 hours ago")).toBeInTheDocument();
  });

  it("says Never for someone who has not logged in, and Yesterday for yesterday", () => {
    renderPage();

    expect(within(row(/Fatima Sheikh/)).getByText("Never")).toBeInTheDocument();
    expect(
      within(row(/Meera Joshi/)).getByText("Yesterday"),
    ).toBeInTheDocument();
  });

  it("marks a suspended account and an unconfirmed email", () => {
    renderPage();

    expect(within(row(/Dev Verma/)).getByText("Suspended")).toBeInTheDocument();
    expect(
      within(row(/Fatima Sheikh/)).getByText("Not verified"),
    ).toBeInTheDocument();
    expect(
      within(row(/Fatima Sheikh/)).getByText("Pending"),
    ).toBeInTheDocument();
  });

  it("links each name to the user's profile page", () => {
    renderPage();

    expect(
      within(row(/Rahul Sharma/)).getByRole("link", { name: "Rahul Sharma" }),
    ).toHaveAttribute("href", `/admin/users/${rahul.id}`);
  });

  it("shows the paging line from the platform total", () => {
    renderPage();

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toHaveTextContent("Showing 1–8 of 4,812");
  });

  it("Next asks for page 2 and Previous is off on the first page", async () => {
    const { onPageChange } = renderPage();
    const pagination = screen.getByRole("navigation", { name: "Pagination" });

    expect(
      within(pagination).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();
    await userEvent.click(
      within(pagination).getByRole("button", { name: "Next" }),
    );

    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("AdminUsers: tabs", () => {
  it("shows a count on each tab, the suspended one included", () => {
    renderPage();

    expect(screen.getByRole("tab", { name: /All users/ })).toHaveTextContent(
      "4,812",
    );
    expect(screen.getByRole("tab", { name: /Attendees/ })).toHaveTextContent(
      "4,701",
    );
    expect(screen.getByRole("tab", { name: /Suspended/ })).toHaveTextContent(
      "6",
    );
  });

  it("starts on All users; picking a tab selects it and filters the list", async () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /All users/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await userEvent.click(screen.getByRole("tab", { name: /Suspended/ }));

    expect(screen.getByRole("tab", { name: /Suspended/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Dev Verma");
  });

  it("the Unverified email tab lists the accounts whose email is not confirmed", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("tab", { name: /Unverified email/ }),
    );

    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("Vikram Mehta"),
      expect.stringContaining("Fatima Sheikh"),
    ]);
  });

  it("the list is the tab's panel, labelled by the selected tab", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("tab", { name: /Speakers/ }));

    expect(
      screen.getByRole("tabpanel", { name: /Speakers/ }),
    ).toBeInTheDocument();
  });

  it("only the selected tab is in the Tab order; arrow keys move to the next tab and select it", async () => {
    renderPage();
    const all = screen.getByRole("tab", { name: /All users/ });
    expect(all).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Attendees/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    all.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Attendees/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Attendees/ })).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /Suspended/ })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /All users/ })).toHaveFocus();
  });

  it("with a tab picked, the paging line uses that tab's platform count", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("tab", { name: /Suspended/ }));

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toHaveTextContent("Showing 1–1 of 6");
  });
});

describe("AdminUsers: search and filters", () => {
  it("searches by name or email", async () => {
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "joshi",
    );

    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Meera Joshi");
  });

  it("says so when nothing matches", async () => {
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "zzzz",
    );

    expect(screen.getByText("No users match your search.")).toBeInTheDocument();
  });

  it("filters by role and by status together", async () => {
    renderPage();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role" }),
      "user",
    );
    expect(rows()).toHaveLength(2);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "suspended",
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Dev Verma");
  });

  it("sorts by name A–Z", async () => {
    renderPage();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "name",
    );

    expect(rows()[0]).toHaveTextContent("Admin User");
  });
});

describe("AdminUsers: row menu", () => {
  it("offers view profile, change role and suspend for an active user", async () => {
    renderPage();

    await openMenu("Rahul Sharma");

    const menu = screen.getByRole("menu", { name: "Actions for Rahul Sharma" });
    expect(
      within(menu).getByRole("menuitem", { name: "View profile" }),
    ).toHaveAttribute("href", `/admin/users/${rahul.id}`);
    expect(
      within(menu).getByRole("menuitem", { name: "Change role" }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Suspend user" }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", {
        name: "Send password setup link",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Reactivate user" }),
    ).not.toBeInTheDocument();
  });

  it("offers a setup link only to an account that has not set a password yet", async () => {
    const { onResendSetup } = renderPage();

    await openMenu("Vikram Mehta");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Send password setup link" }),
    );

    expect(onResendSetup).toHaveBeenCalledWith(vikram.id);
  });

  it("offers Reactivate instead of Suspend for a suspended user", async () => {
    const { onReactivate } = renderPage();

    await openMenu("Dev Verma");
    expect(
      screen.queryByRole("menuitem", { name: "Suspend user" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Reactivate user" }),
    );

    expect(onReactivate).toHaveBeenCalledWith(dev.id);
  });
});

describe("AdminUsers: suspend", () => {
  async function openSuspend() {
    await openMenu("Rahul Sharma");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Suspend user" }),
    );
    return screen.getByRole("dialog", { name: "Suspend Rahul Sharma?" });
  }

  it("explains what suspending does and offers to email the person, ticked by default", async () => {
    renderPage();
    const dialog = await openSuspend();

    expect(dialog).toHaveTextContent("Rahul will not be able to log in");
    expect(
      within(dialog).getByRole("checkbox", { name: /Email Rahul/ }),
    ).toBeChecked();
  });

  it("will not suspend without a reason", async () => {
    const { onSuspend } = renderPage();
    const dialog = await openSuspend();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    expect(
      await within(dialog).findByText(
        "Enter a reason: it is kept in the audit log.",
      ),
    ).toBeInTheDocument();
    expect(onSuspend).not.toHaveBeenCalled();
  });

  it("suspends that user with the trimmed reason and the notify choice, then closes", async () => {
    const { onSuspend } = renderPage();
    const dialog = await openSuspend();

    await userEvent.type(
      within(dialog).getByLabelText("Reason"),
      "  Repeated spam  ",
    );
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: /Email Rahul/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    await waitFor(() =>
      expect(onSuspend).toHaveBeenCalledWith(rahul.id, {
        reason: "Repeated spam",
        notifyUser: false,
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel closes without suspending", async () => {
    const { onSuspend } = renderPage();
    const dialog = await openSuspend();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(onSuspend).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AdminUsers: change role", () => {
  async function openRole(name: string) {
    await openMenu(name);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Change role" }),
    );
    return screen.getByRole("dialog", { name: `Change role for ${name}` });
  }

  it("starts on the user's current role and cannot save until another is picked", async () => {
    renderPage();
    const dialog = await openRole("Meera Joshi");

    expect(
      within(dialog).getByRole("radio", { name: /Speaker/ }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Save role" }),
    ).toBeDisabled();

    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Attendee/ }),
    );

    expect(
      within(dialog).getByRole("button", { name: "Save role" }),
    ).toBeEnabled();
  });

  it("offers one role at a time, not several", async () => {
    renderPage();
    const dialog = await openRole("Meera Joshi");

    expect(within(dialog).getAllByRole("radio")).toHaveLength(4);
  });

  it("saves the new role for that user and closes", async () => {
    const { onChangeRole } = renderPage();
    const dialog = await openRole("Meera Joshi");

    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Organizer/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save role" }),
    );

    await waitFor(() =>
      expect(onChangeRole).toHaveBeenCalledWith(meera.id, {
        role: "organizer",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tells the admin when the change takes effect", async () => {
    renderPage();
    const dialog = await openRole("Meera Joshi");

    expect(dialog).toHaveTextContent(
      "Changes apply the next time Meera opens EventSphere.",
    );
  });
});

describe("AdminUsers: invite", () => {
  async function openInvite() {
    await userEvent.click(screen.getByRole("button", { name: "Invite user" }));
    return screen.getByRole("dialog", { name: "Invite a user" });
  }

  it("says the link works for 24 hours", async () => {
    renderPage();
    const dialog = await openInvite();

    expect(dialog).toHaveTextContent("valid for 24 hours");
  });

  it("offers speaker, organizer and administrator, with speaker chosen", async () => {
    renderPage();
    const dialog = await openInvite();

    const role = within(dialog).getByRole("combobox", { name: "Role" });
    expect(role).toHaveValue("speaker");
    expect(
      within(role)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Speaker", "Organizer", "Administrator"]);
  });

  it("shows what is missing, and sends nothing", async () => {
    const { onInvite } = renderPage();
    const dialog = await openInvite();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitation" }),
    );

    expect(
      await within(dialog).findByText("First name is required"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Last name is required"),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Email address")).toBeInvalid();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it("sends the invitation with a trimmed, lowercased email, then closes", async () => {
    const { onInvite } = renderPage();
    const dialog = await openInvite();

    await userEvent.type(within(dialog).getByLabelText("First name"), "Nisha");
    await userEvent.type(within(dialog).getByLabelText("Last name"), "Patel");
    await userEvent.type(
      within(dialog).getByLabelText("Email address"),
      "  Nisha@Example.com ",
    );
    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: "Role" }),
      "organizer",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send invitation" }),
    );

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({
        firstName: "Nisha",
        lastName: "Patel",
        email: "nisha@example.com",
        role: "organizer",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens empty again after a cancelled attempt", async () => {
    renderPage();
    let dialog = await openInvite();
    await userEvent.type(within(dialog).getByLabelText("First name"), "Nisha");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    dialog = await openInvite();

    expect(within(dialog).getByLabelText("First name")).toHaveValue("");
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminUsers: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const view = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <AdminUsers data={ADMIN_USERS_SAMPLE} />
      </Activity>
    );
    const { rerender } = render(view("visible"));
    await userEvent.click(screen.getByRole("button", { name: "Invite user" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
