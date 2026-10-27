/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { usersApiService } from "../../api/users-api.service";
import type { UserDetailDto } from "../../schemas/users.schema";
import { AdminUserDetail } from "../AdminUserDetail";

// Only the API layer is replaced: the hooks, the cache and the screens are the real ones.
jest.mock("../../api/users-api.service", () => ({
  usersApiService: {
    list: jest.fn(),
    get: jest.fn(),
    suspend: jest.fn(),
    reactivate: jest.fn(),
    sendResetLink: jest.fn(),
    resendInvite: jest.fn(),
  },
}));
const api = jest.mocked(usersApiService);

const userId = "8f2c41a0-6b1e-4c52-9a3d-7e5b1c0d2f34";

const ananya: UserDetailDto = {
  id: userId,
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya.rao@example.com",
  status: "active",
  role: "user",
  emailVerifiedAt: "2026-10-20T09:21:00.000Z",
  createdAt: "2026-10-20T09:18:00.000Z",
  hasPassword: true,
  permissions: ["PROFILE_VIEW", "REGISTRATION_CREATE", "POLL_VOTE"],
};

/** A fake server holding one user: suspending and reactivating change what the next read returns. */
function serve(overrides: Partial<UserDetailDto> = {}) {
  let current: UserDetailDto = { ...ananya, ...overrides };
  api.get.mockImplementation(async () => ({ ...current }));
  api.suspend.mockImplementation(async () => {
    current = { ...current, status: "suspended" };
    return {
      id: userId,
      firstName: "Ananya",
      lastName: "Rao",
      status: "suspended",
    };
  });
  api.reactivate.mockImplementation(async () => {
    current = { ...current, status: "active" };
    return {
      id: userId,
      firstName: "Ananya",
      lastName: "Rao",
      status: "active",
    };
  });
  api.sendResetLink.mockResolvedValue({
    expiresAt: "2026-10-27T10:10:00.000Z",
  });
}

function renderUser(id = userId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminUserDetail userId={id} />
    </QueryClientProvider>,
  );
}

const card = (name: string) => screen.getByRole("region", { name });
const header = () =>
  screen
    .getByRole("heading", { level: 2, name: "Ananya Rao" })
    .closest("section") as HTMLElement;
const loaded = () =>
  screen.findByRole("heading", { level: 2, name: "Ananya Rao" });

beforeEach(() => {
  jest.resetAllMocks();
  serve();
});

describe("AdminUserDetail: loading the user", () => {
  it("shows a loading state, then the user", async () => {
    renderUser();

    expect(
      screen.getByRole("status", { name: "Loading user" }),
    ).toBeInTheDocument();
    await loaded();
    expect(
      screen.queryByRole("status", { name: "Loading user" }),
    ).not.toBeInTheDocument();
  });

  it("asks the API for the id in the URL, and only that", async () => {
    renderUser();
    await loaded();

    expect(api.get).toHaveBeenCalledWith(userId);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("a failed load shows the error with Try again", async () => {
    api.get.mockRejectedValueOnce(
      new ApiError(500, "INTERNAL", "Something went wrong"),
    );
    renderUser();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load this user");
    expect(alert).toHaveTextContent("Something went wrong");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" }),
    );

    await loaded();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("an unknown user says so, with a way back to the list", async () => {
    api.get.mockRejectedValue(new ApiError(404, "NOT_FOUND", "User not found"));
    renderUser();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("User not found");
    expect(
      within(alert).getByRole("link", { name: "Back to users" }),
    ).toHaveAttribute("href", "/admin/users");
  });
});

describe("AdminUserDetail: what the admin reads", () => {
  it("names the user in the breadcrumb and shows the page title", async () => {
    renderUser();
    await loaded();

    expect(
      screen.getByRole("heading", { level: 1, name: "User profile" }),
    ).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(
      within(breadcrumb).getByRole("link", { name: "Users" }),
    ).toHaveAttribute("href", "/admin/users");
    expect(within(breadcrumb).getByText("Ananya Rao")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows who they are: status, email and role", async () => {
    renderUser();
    await loaded();
    const top = within(header());

    expect(top.getByText("Active")).toBeInTheDocument();
    expect(top.getByText("ananya.rao@example.com")).toBeInTheDocument();
    expect(top.getByText("Attendee")).toBeInTheDocument();
  });

  it("shows the account: verified email, password and when they joined, but not the user id", async () => {
    renderUser();
    await loaded();
    const account = card("Account");

    // The id is an internal detail (it is already in the URL): it is not on the page.
    expect(screen.queryByText(userId)).not.toBeInTheDocument();
    expect(within(account).queryByText("User ID")).not.toBeInTheDocument();
    expect(within(account).getByText("Verified")).toBeInTheDocument();
    expect(within(account).getByText("Set by user")).toBeInTheDocument();
    expect(
      within(account).getByText("20 October 2026, 09:18"),
    ).toBeInTheDocument();
  });

  it("says when the password is not set yet, and when the email is not verified", async () => {
    serve({ status: "pending", hasPassword: false, emailVerifiedAt: null });
    renderUser();
    await loaded();
    const account = card("Account");

    expect(within(account).getByText("Not set yet")).toBeInTheDocument();
    expect(within(account).getByText("Not verified")).toBeInTheDocument();
  });

  it("shows the role with what it allows, and the permission keys that come from it", async () => {
    renderUser();
    await loaded();
    const roles = card("Role and permissions");

    expect(within(roles).getByText("Assigned")).toBeInTheDocument();
    expect(
      within(roles).getByText(/Can register for events, book sessions/),
    ).toBeInTheDocument();
    expect(within(roles).getByText("REGISTRATION_CREATE")).toBeInTheDocument();
    expect(within(roles).getByText("POLL_VOTE")).toBeInTheDocument();
  });

  it("says when the account has no role or no permissions", async () => {
    serve({ role: null, permissions: [] });
    renderUser();
    await loaded();

    const roles = card("Role and permissions");
    expect(within(roles).getByText("No role assigned")).toBeInTheDocument();
    expect(within(roles).getByText("None.")).toBeInTheDocument();
  });

  it.each([
    ["speaker", "Speaker"],
    ["organizer", "Organizer"],
  ] as const)(
    "a %s gets the same page: only their account, with nothing from their own section",
    async (role, label) => {
      serve({ role });
      renderUser();
      await loaded();

      expect(within(header()).getByText(label)).toBeInTheDocument();
      expect(
        screen.queryByText(/Organizer application/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Organizer pending")).not.toBeInTheDocument();
      expect(screen.queryByText(/Event registrations/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Audit log/)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Change role/ }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("AdminUserDetail: suspend and reactivate", () => {
  it("asks for confirmation first, and Cancel changes nothing", async () => {
    renderUser();
    await loaded();
    await userEvent.click(
      within(card("Admin actions")).getByRole("button", {
        name: "Suspend user",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "Suspend Ananya Rao?" });
    expect(api.suspend).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.suspend).not.toHaveBeenCalled();
  });

  it("suspends that user, closes, and the page shows them as suspended", async () => {
    renderUser();
    await loaded();
    await userEvent.click(
      within(header()).getByRole("button", { name: "Suspend" }),
    );

    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend user",
      }),
    );

    await waitFor(() => expect(api.suspend).toHaveBeenCalledWith(userId));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // The user is read again: the page shows what the server now says.
    await waitFor(() =>
      expect(within(header()).getByText("Suspended")).toBeInTheDocument(),
    );
    expect(api.get.mock.calls.length).toBeGreaterThan(1);
    expect(
      within(header()).queryByRole("button", { name: "Suspend" }),
    ).not.toBeInTheDocument();
    expect(
      within(card("Admin actions")).getByText("Account suspended"),
    ).toBeInTheDocument();
  });

  it("shows why it failed and stays open so the admin can try again", async () => {
    api.suspend.mockRejectedValueOnce(
      new ApiError(
        409,
        "USER_NOT_ACTIVE",
        "Only an active user can be suspended",
      ),
    );
    renderUser();
    await loaded();
    await userEvent.click(
      within(card("Admin actions")).getByRole("button", {
        name: "Suspend user",
      }),
    );
    const dialog = screen.getByRole("dialog");

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
    renderUser();
    await loaded();
    await userEvent.click(
      within(card("Admin actions")).getByRole("button", {
        name: "Suspend user",
      }),
    );
    const dialog = screen.getByRole("dialog");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend user" }),
    );

    const working = await within(dialog).findByRole("button", {
      name: "Suspending…",
    });
    expect(working).toBeDisabled();
    expect(api.suspend).toHaveBeenCalledTimes(1);
  });

  it("Reactivate lets a suspended user back in, and the page shows them as active", async () => {
    serve({ status: "suspended" });
    renderUser();
    await loaded();

    await userEvent.click(
      within(header()).getByRole("button", { name: "Reactivate" }),
    );

    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith(userId));
    await waitFor(() =>
      expect(within(header()).getByText("Active")).toBeInTheDocument(),
    );
    expect(
      within(card("Admin actions")).getByRole("button", {
        name: "Suspend user",
      }),
    ).toBeInTheDocument();
  });

  it("shows why a reactivation failed, without a dialog", async () => {
    serve({ status: "suspended" });
    api.reactivate.mockRejectedValueOnce(
      new ApiError(
        409,
        "USER_NOT_SUSPENDED",
        "Only a suspended user can be reactivated",
      ),
    );
    renderUser();
    await loaded();

    await userEvent.click(
      within(header()).getByRole("button", { name: "Reactivate" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Only a suspended user can be reactivated",
    );
  });

  it("an administrator cannot be suspended, so there is no button for it", async () => {
    serve({ role: "admin" });
    renderUser();
    await loaded();

    expect(
      screen.queryByRole("button", { name: /Suspend/ }),
    ).not.toBeInTheDocument();
    expect(
      within(card("Admin actions")).getByText(
        /cannot be suspended or sent a reset link/,
      ),
    ).toBeInTheDocument();
  });

  it("a pending account cannot be suspended either", async () => {
    serve({ status: "pending", hasPassword: false });
    renderUser();
    await loaded();

    expect(
      screen.queryByRole("button", { name: /Suspend/ }),
    ).not.toBeInTheDocument();
  });
});

describe("AdminUserDetail: send a password reset link", () => {
  const actions = () => card("Admin actions");
  const openDialog = async () => {
    await userEvent.click(
      within(actions()).getByRole("button", {
        name: "Send password reset link",
      }),
    );
    return screen.getByRole("dialog", {
      name: "Send a reset link to Ananya Rao?",
    });
  };

  it("asks for confirmation and says what the person gets, without sending anything yet", async () => {
    renderUser();
    await loaded();

    const dialog = await openDialog();

    expect(dialog).toHaveTextContent("ananya.rao@example.com");
    expect(dialog).toHaveTextContent("works once");
    expect(api.sendResetLink).not.toHaveBeenCalled();
  });

  it("sends the link to that user, closes, and says it was sent", async () => {
    renderUser();
    await loaded();
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => expect(api.sendResetLink).toHaveBeenCalledWith(userId));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Reset link sent to ananya.rao@example.com",
    );
  });

  it("shows why it failed (a link was sent a moment ago) and stays open", async () => {
    api.sendResetLink.mockRejectedValueOnce(
      new ApiError(
        429,
        "RATE_LIMITED",
        "A reset link was sent moments ago. Try again in 30 seconds.",
      ),
    );
    renderUser();
    await loaded();
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send reset link" }),
    );

    expect(
      await within(dialog).findByText(/sent moments ago/),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("cannot be pressed twice while the request runs", async () => {
    api.sendResetLink.mockReturnValue(new Promise(() => {}));
    renderUser();
    await loaded();
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Send reset link" }),
    );

    const working = await within(dialog).findByRole("button", {
      name: "Sending…",
    });
    expect(working).toBeDisabled();
    expect(api.sendResetLink).toHaveBeenCalledTimes(1);
  });

  it("is not offered for an administrator", async () => {
    serve({ role: "admin" });
    renderUser();
    await loaded();

    expect(
      screen.queryByRole("button", { name: "Send password reset link" }),
    ).not.toBeInTheDocument();
  });

  it("is not offered for a pending account: it gets the set-password invite instead", async () => {
    serve({ status: "pending", hasPassword: false });
    renderUser();
    await loaded();

    expect(
      screen.queryByRole("button", { name: "Send password reset link" }),
    ).not.toBeInTheDocument();
    expect(
      within(actions()).getByRole("button", { name: "Resend invite" }),
    ).toBeInTheDocument();
  });

  it("is not offered for a suspended account, and the page says to reactivate first", async () => {
    serve({ status: "suspended" });
    renderUser();
    await loaded();

    expect(
      screen.queryByRole("button", { name: "Send password reset link" }),
    ).not.toBeInTheDocument();
    expect(
      within(actions()).getByText(/Reactivate it first/),
    ).toBeInTheDocument();
  });
});

describe("AdminUserDetail: resend invite", () => {
  const actions = () => card("Admin actions");
  const resendButton = () =>
    within(actions()).getByRole("button", { name: "Resend invite" });

  beforeEach(() => {
    api.resendInvite.mockResolvedValue({
      setupEmailQueued: true,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
  });

  it("is offered for a pending account", async () => {
    serve({ status: "pending", hasPassword: false, role: "speaker" });
    renderUser();
    await loaded();

    expect(resendButton()).toBeInTheDocument();
    expect(within(actions()).getByText(/not set a password yet/)).toBeVisible();
  });

  it("is not offered for an active or a suspended account", async () => {
    serve({ status: "active" });
    const { unmount } = renderUser();
    await loaded();
    expect(
      screen.queryByRole("button", { name: "Resend invite" }),
    ).not.toBeInTheDocument();
    unmount();

    serve({ status: "suspended" });
    renderUser();
    await loaded();
    expect(
      screen.queryByRole("button", { name: "Resend invite" }),
    ).not.toBeInTheDocument();
  });

  it("sends the invite for this user and says where it went", async () => {
    serve({ status: "pending", hasPassword: false });
    renderUser();
    await loaded();

    await userEvent.click(resendButton());

    expect(api.resendInvite).toHaveBeenCalledWith(userId);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invite sent to ananya.rao@example.com",
    );
  });

  it("warns when the invite was saved but the email could not be queued", async () => {
    api.resendInvite.mockResolvedValue({
      setupEmailQueued: false,
      expiresAt: "2026-10-30T09:00:00.000Z",
    });
    serve({ status: "pending", hasPassword: false });
    renderUser();
    await loaded();

    await userEvent.click(resendButton());

    // A warning is announced at once, like an error: role="alert".
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The new invite was saved, but the email was not sent",
    );
  });

  it("shows why it failed (e.g. already set up)", async () => {
    api.resendInvite.mockRejectedValue(
      new ApiError(
        409,
        "ACCOUNT_ALREADY_ACTIVE",
        "This person has already set up their account.",
      ),
    );
    serve({ status: "pending", hasPassword: false });
    renderUser();
    await loaded();

    await userEvent.click(resendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already set up their account",
    );
  });
});

// Next.js (cacheComponents) hides a page we leave with <Activity> instead of unmounting it.
describe("AdminUserDetail: hidden and shown again", () => {
  it("comes back with no dialog open", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = (mode: "visible" | "hidden") => (
      <QueryClientProvider client={client}>
        <Activity mode={mode}>
          <AdminUserDetail userId={userId} />
        </Activity>
      </QueryClientProvider>
    );
    const { rerender } = render(view("visible"));
    await loaded();
    await userEvent.click(
      within(card("Admin actions")).getByRole("button", {
        name: "Suspend user",
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(view("hidden"));
    rerender(view("visible"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
