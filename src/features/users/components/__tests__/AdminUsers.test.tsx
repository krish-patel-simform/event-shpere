/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { dev, noRole, rahul, userRows, vikram } from "../../__fixtures__/users";
import { usersApiService } from "../../api/users-api.service";
import type { UserListItemDto } from "../../schemas/users.schema";
import { AdminUsers } from "../AdminUsers";

// Only the API layer is replaced: the hooks, the cache and the screens are the real ones.
jest.mock("../../api/users-api.service", () => ({
  usersApiService: {
    list: jest.fn(),
    suspend: jest.fn(),
    reactivate: jest.fn(),
    resendInvite: jest.fn(),
  },
}));
const api = jest.mocked(usersApiService);

/** A fake server: filters, sorts and pages like the real endpoint. */
function serve(rows: UserListItemDto[] = userRows) {
  api.list.mockImplementation(
    async ({
      role,
      status,
      search = "",
      sort = "newest",
      page = 1,
      pageSize,
    }) => {
      const matches = rows
        .filter((row) => !role || row.role === role)
        .filter((row) => !status || row.status === status)
        .filter((row) =>
          `${row.firstName} ${row.lastName} ${row.email}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        );
      if (sort === "name") {
        matches.sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`,
          ),
        );
      }
      return {
        items: matches.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, total: matches.length },
      };
    },
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminUsers />
    </QueryClientProvider>,
  );
}

const rows = () => screen.getAllByRole("row").slice(1);
const row = (name: RegExp) => screen.getByRole("row", { name });
const openMenu = async (name: string) => {
  await userEvent.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
  return screen.getByRole("menu", { name: `Actions for ${name}` });
};
const lastListCall = () => api.list.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.resetAllMocks();
  serve();
  api.suspend.mockResolvedValue({
    id: rahul.id,
    firstName: "Rahul",
    lastName: "Sharma",
    status: "suspended",
  });
  api.reactivate.mockResolvedValue({
    id: dev.id,
    firstName: "Dev",
    lastName: "Verma",
    status: "active",
  });
});

describe("AdminUsers: list", () => {
  it("shows a loading state first, then the accounts", async () => {
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading users" }),
    ).toBeInTheDocument();

    await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(
      screen.queryByRole("status", { name: "Loading users" }),
    ).not.toBeInTheDocument();
    expect(rows()).toHaveLength(8);
  });

  it("asks the server for the first page, newest first, with no filters", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(api.list).toHaveBeenCalledWith({
      role: undefined,
      status: undefined,
      search: "",
      sort: "newest",
      page: 1,
      pageSize: 10,
    });
  });

  it("shows each account with role, email status, account status and joined date", async () => {
    renderPage();
    const first = await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(
      within(first).getByText("ananya.rao@example.com"),
    ).toBeInTheDocument();
    expect(within(first).getByText("Organizer")).toBeInTheDocument();
    expect(within(first).getByText("Verified")).toBeInTheDocument();
    expect(within(first).getByText("Active")).toBeInTheDocument();
    expect(within(first).getByText("20 Oct 2026")).toBeInTheDocument();
  });

  it("marks a suspended account, a pending one and an unconfirmed email", async () => {
    renderPage();

    expect(
      within(await screen.findByRole("row", { name: /Dev Verma/ })).getByText(
        "Suspended",
      ),
    ).toBeInTheDocument();
    expect(
      within(row(/Fatima Sheikh/)).getByText("Pending"),
    ).toBeInTheDocument();
    expect(
      within(row(/Fatima Sheikh/)).getByText("Not verified"),
    ).toBeInTheDocument();
  });

  it("has no Last active column and no Invite button: the API has no such data and admins do not create users here", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(
      screen.queryByRole("columnheader", { name: "Last active" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Invite user" }),
    ).not.toBeInTheDocument();
  });

  it("an account with no role still shows", async () => {
    serve([noRole]);
    renderPage();

    expect(
      within(await screen.findByRole("row", { name: /Nora Norole/ })).getByText(
        "No role",
      ),
    ).toBeInTheDocument();
  });

  it("links each name to the user's profile page", async () => {
    renderPage();

    expect(
      within(
        await screen.findByRole("row", { name: /Rahul Sharma/ }),
      ).getByRole("link", { name: "Rahul Sharma" }),
    ).toHaveAttribute("href", `/admin/users/${rahul.id}`);
  });

  it("says so when there are no users", async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText("No users yet.")).toBeInTheDocument();
  });

  it("shows the error with Try again when the list cannot be loaded", async () => {
    api.list.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load the users");
    expect(alert).toHaveTextContent("Something went wrong");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    expect(
      await screen.findByRole("row", { name: /Ananya Rao/ }),
    ).toBeInTheDocument();
  });
});

describe("AdminUsers: paging", () => {
  it("shows the total from the server and pages with Next and Previous", async () => {
    serve(
      Array.from({ length: 23 }, (_, i) => ({
        ...rahul,
        id: `6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e${i}`,
        firstName: `User${i}`,
      })),
    );
    renderPage();
    const pagination = await screen.findByRole("navigation", {
      name: "Pagination",
    });
    expect(pagination).toHaveTextContent("Showing 1–10 of 23");
    expect(
      within(pagination).getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    await userEvent.click(
      within(pagination).getByRole("button", { name: "Next" }),
    );

    await waitFor(() =>
      expect(lastListCall()).toEqual(expect.objectContaining({ page: 2 })),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("navigation", { name: "Pagination" }),
      ).toHaveTextContent("Showing 11–20 of 23"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() =>
      expect(lastListCall()).toEqual(expect.objectContaining({ page: 1 })),
    );
  });

  it("a new filter starts again from page 1", async () => {
    serve(
      Array.from({ length: 23 }, (_, i) => ({
        ...rahul,
        id: `6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e${i}`,
        firstName: `User${i}`,
      })),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(lastListCall()).toEqual(expect.objectContaining({ page: 2 })),
    );

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "active",
    );

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ status: "active", page: 1 }),
      ),
    );
  });
});

describe("AdminUsers: tabs", () => {
  it("starts on All users and has no counts (the API does not give them yet)", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(screen.getByRole("tab", { name: "All users" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(
      screen.queryByRole("tab", { name: /Unverified/ }),
    ).not.toBeInTheDocument();
  });

  it("a role tab asks the server for that role", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    await userEvent.click(screen.getByRole("tab", { name: "Speakers" }));

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ role: "speaker", status: undefined }),
      ),
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(
      screen.getByRole("tabpanel", { name: "Speakers" }),
    ).toBeInTheDocument();
  });

  it("shows the loading skeleton, not the previous tab's rows, while another tab loads", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    // The next request is held back, so what is on screen meanwhile can be checked.
    const release: { run: () => void } = { run: () => {} };
    const held = new Promise<void>((resolve) => (release.run = resolve));
    const respond = api.list.getMockImplementation()!;
    api.list.mockImplementation(async (params) => {
      await held;
      return respond(params);
    });

    await userEvent.click(screen.getByRole("tab", { name: "Speakers" }));

    expect(
      await screen.findByRole("status", { name: "Loading users" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
    expect(screen.queryByText("Ananya Rao")).not.toBeInTheDocument();

    release.run();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(
      screen.queryByRole("status", { name: "Loading users" }),
    ).not.toBeInTheDocument();
  });

  it("the Suspended tab asks for the suspended status", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    await userEvent.click(screen.getByRole("tab", { name: "Suspended" }));

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ status: "suspended", role: undefined }),
      ),
    );
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent("Dev Verma");
  });

  it("only the selected tab is in the Tab order; arrow keys move to the next tab and select it", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });
    const all = screen.getByRole("tab", { name: "All users" });
    expect(all).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Attendees" })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    all.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Attendees" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Attendees" })).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Suspended" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "All users" })).toHaveFocus();
  });

  it("has no Role select: the tabs are the only way to pick a role", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    expect(
      screen.queryByRole("combobox", { name: "Role" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("combobox").map((select) => select.ariaLabel),
    ).toEqual(["Status", "Sort"]);

    await userEvent.click(screen.getByRole("tab", { name: "Speakers" }));
    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ role: "speaker" }),
      ),
    );
  });
});

describe("AdminUsers: search, filters, sort", () => {
  it("asks the server for the typed text once typing pauses, not for every key", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "joshi",
    );

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ search: "joshi" }),
      ),
    );
    expect(api.list.mock.calls.map(([params]) => params.search)).not.toContain(
      "jo",
    );
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent("Meera Joshi");
  });

  it("says so when nothing matches", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search users" }),
      "zzzz",
    );

    expect(
      await screen.findByText("No users match your search."),
    ).toBeInTheDocument();
  });

  it("sends the Status select, together with the tab's role, to the server", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });
    await userEvent.click(screen.getByRole("tab", { name: "Attendees" }));

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "suspended",
    );

    await waitFor(() =>
      expect(lastListCall()).toEqual(
        expect.objectContaining({ role: "user", status: "suspended" }),
      ),
    );
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it("sorts by name on the server, and offers only the sorts the server has", async () => {
    renderPage();
    await screen.findByRole("row", { name: /Ananya Rao/ });
    const sort = screen.getByRole("combobox", { name: "Sort" });
    expect(
      within(sort)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Sort: Newest first", "Sort: Name A–Z"]);

    await userEvent.selectOptions(sort, "name");

    await waitFor(() =>
      expect(lastListCall()).toEqual(expect.objectContaining({ sort: "name" })),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent("Admin User"));
  });
});

describe("AdminUsers: row menu", () => {
  it("offers view profile and suspend for an active user", async () => {
    renderPage();

    const menu = await openMenu("Rahul Sharma");

    expect(
      within(menu).getByRole("menuitem", { name: "View profile" }),
    ).toHaveAttribute("href", `/admin/users/${rahul.id}`);
    expect(
      within(menu).getByRole("menuitem", { name: "Suspend user" }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Reactivate user" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: /Change role|setup link/ }),
    ).not.toBeInTheDocument();
  });

  it("offers Reactivate instead of Suspend for a suspended user", async () => {
    renderPage();

    const menu = await openMenu("Dev Verma");

    expect(
      within(menu).getByRole("menuitem", { name: "Reactivate user" }),
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", { name: "Suspend user" }),
    ).not.toBeInTheDocument();
  });

  it("offers no Suspend for an administrator (the server refuses it too)", async () => {
    renderPage();

    const menu = await openMenu("Admin User");

    expect(
      within(menu).queryByRole("menuitem", { name: "Suspend user" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "View profile" }),
    ).toBeInTheDocument();
  });

  it("offers no Suspend for a pending account (nothing to suspend yet)", async () => {
    renderPage();

    const menu = await openMenu("Vikram Mehta");

    expect(
      within(menu).queryByRole("menuitem", { name: /Suspend|Reactivate/ }),
    ).not.toBeInTheDocument();
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

  it("explains what suspending does; there is nothing to type", async () => {
    renderPage();
    const dialog = await openSuspend();

    expect(dialog).toHaveTextContent("Rahul will not be able to log in");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(api.suspend).not.toHaveBeenCalled();
  });

  it("suspends that user, closes, and loads the list again", async () => {
    renderPage();
    const dialog = await openSuspend();
    const callsBefore = api.list.mock.calls.length;

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    await waitFor(() => expect(api.suspend).toHaveBeenCalledWith(rahul.id));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(api.list.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("shows why it failed and stays open to try again", async () => {
    api.suspend.mockRejectedValueOnce(
      new ApiError(
        409,
        "USER_NOT_ACTIVE",
        "Only an active user can be suspended",
      ),
    );
    renderPage();
    const dialog = await openSuspend();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    expect(
      await within(dialog).findByText("Only an active user can be suspended"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.suspend.mockReturnValue(new Promise(() => {}));
    renderPage();
    const dialog = await openSuspend();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    expect(
      await within(dialog).findByRole("button", { name: "Suspending…" }),
    ).toBeDisabled();
    expect(api.suspend).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without suspending", async () => {
    renderPage();
    const dialog = await openSuspend();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(api.suspend).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AdminUsers: reactivate", () => {
  it("reactivates the user straight from the menu and loads the list again", async () => {
    renderPage();
    await openMenu("Dev Verma");
    const callsBefore = api.list.mock.calls.length;

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Reactivate user" }),
    );

    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith(dev.id));
    await waitFor(() =>
      expect(api.list.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("shows why it failed, without a dialog", async () => {
    api.reactivate.mockRejectedValueOnce(
      new ApiError(
        409,
        "USER_NOT_SUSPENDED",
        "Only a suspended user can be reactivated",
      ),
    );
    renderPage();
    await openMenu("Dev Verma");

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Reactivate user" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a suspended user can be reactivated",
    );
  });
});

describe("AdminUsers: resend invite", () => {
  beforeEach(() => {
    api.resendInvite.mockResolvedValue({
      setupEmailQueued: true,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
  });

  const resend = async (name: string) => {
    const menu = await openMenu(name);
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Resend invite" }),
    );
  };

  it("is offered for a pending account (any role), and only for those", async () => {
    renderPage();

    const pending = await openMenu("Vikram Mehta");
    expect(
      within(pending).getByRole("menuitem", { name: "Resend invite" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const active = await openMenu("Ananya Rao");
    expect(
      within(active).queryByRole("menuitem", { name: "Resend invite" }),
    ).not.toBeInTheDocument();
  });

  it("sends the invite for that user and says who got it", async () => {
    renderPage();

    await resend("Vikram Mehta");

    expect(api.resendInvite).toHaveBeenCalledWith(vikram.id);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invite sent to vikram.mehta@example.com",
    );
  });

  it("warns when the invite was saved but the email could not be queued", async () => {
    api.resendInvite.mockResolvedValue({
      setupEmailQueued: false,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
    renderPage();

    await resend("Vikram Mehta");

    // A warning is announced at once, like an error: role="alert".
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The new invite was saved, but the email was not sent",
    );
  });

  it("shows why it failed (an invite was sent a moment ago)", async () => {
    api.resendInvite.mockRejectedValue(
      new ApiError(
        429,
        "RATE_LIMITED",
        "An invite was sent moments ago. Try again in 30 seconds.",
      ),
    );
    renderPage();

    await resend("Vikram Mehta");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An invite was sent moments ago",
    );
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminUsers: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <AdminUsers />
        </Activity>
      </QueryClientProvider>
    );
    const { rerender } = render(view("visible"));
    await openMenu("Rahul Sharma");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Suspend user" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
