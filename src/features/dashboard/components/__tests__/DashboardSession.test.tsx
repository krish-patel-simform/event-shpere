/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "@/src/features/auth/api/auth-api.service";
import {
  authQueryKeys,
  useHasPermission,
  usePermissions,
  type MeDto,
} from "@/src/features/auth";
import { DashboardSession } from "../DashboardSession";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/src/features/auth/api/auth-api.service", () => ({
  authApiService: { getMe: jest.fn(), logout: jest.fn() },
}));
const getMe = jest.mocked(authApiService.getMe);
const logout = jest.mocked(authApiService.logout);

const me: MeDto = {
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@example.com",
  role: "organizer",
  permissions: ["EVENT_CREATE"],
};

function renderSession() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DashboardSession>
        <p>Page content</p>
      </DashboardSession>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  mockReplace.mockReset();
  getMe.mockReset();
  getMe.mockResolvedValue(me);
  logout.mockReset();
  logout.mockResolvedValue(undefined);
});

// The side menu is rendered twice (desktop and drawer); either button does the same.
const logOutButton = async () =>
  (await screen.findAllByRole("button", { name: "Log out", hidden: true }))[0];

describe("DashboardSession", () => {
  it("shows a loading state and no page content while the user loads", () => {
    getMe.mockReturnValue(new Promise(() => {}));
    renderSession();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
  });

  it("shows the shell with the user's name and role, and the page content", async () => {
    renderSession();

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(screen.getAllByText("Ananya Rao").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Organizer").length).toBeGreaterThan(0);
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("gives the page the user's permissions without loading the user again", async () => {
    function PermissionProbe() {
      const canCreate = useHasPermission("EVENT_CREATE");
      const canViewUsers = useHasPermission("USER_VIEW");
      return (
        <p>
          create:{String(canCreate)} users:{String(canViewUsers)}
        </p>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <DashboardSession>
          <PermissionProbe />
        </DashboardSession>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("create:true users:false"),
    ).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("nobody signed in (401) is a guest: the page shows with log in / sign up, no redirect", async () => {
    getMe.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Not signed in"),
    );
    renderSession();

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Log in", hidden: true }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Log out", hidden: true }),
    ).not.toBeInTheDocument();
    // A guest is not a failure: no "couldn't load your account" error.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    // The provider reuses the cached 401 instead of asking again.
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("a guest's page sees isGuest and no permissions", async () => {
    getMe.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Not signed in"),
    );
    function GuestProbe() {
      const { isGuest } = usePermissions();
      const canCreate = useHasPermission("EVENT_CREATE");
      return (
        <p>
          guest:{String(isGuest)} create:{String(canCreate)}
        </p>
      );
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <DashboardSession>
          <GuestProbe />
        </DashboardSession>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("guest:true create:false"),
    ).toBeInTheDocument();
  });

  it("a network failure shows an error with 'Try again' and no page content", async () => {
    getMe.mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderSession();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't load your account",
    );
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("a server error also shows the retryable error, not a redirect", async () => {
    getMe.mockRejectedValue(
      new ApiError(500, "INTERNAL_ERROR", "Something went wrong"),
    );
    renderSession();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("'Try again' loads the user again and then shows the page", async () => {
    getMe.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderSession();
    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("DashboardSession: log out", () => {
  it("ends the session, forgets the cached user and goes to the log-in page", async () => {
    const client = renderSession();
    await userEvent.click(await logOutButton());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledTimes(1);
    // The next person to log in on this browser must not see this user's data.
    expect(client.getQueryData(authQueryKeys.me)).toBeUndefined();
  });

  it("does not go to log in until the server has ended the session", async () => {
    logout.mockReturnValue(new Promise(() => {}));
    renderSession();
    await userEvent.click(await logOutButton());

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the signing-out skeleton at once, while the request runs, so nothing else can be done", async () => {
    logout.mockReturnValue(new Promise(() => {}));
    renderSession();
    await userEvent.click(await logOutButton());

    expect(
      await screen.findByRole("status", { name: "Signing out" }),
    ).toBeInTheDocument();
    // The page and the menu are gone: no second Log out click, no other action meanwhile.
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out", hidden: true }),
    ).not.toBeInTheDocument();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("after success it shows a signing-out state instead of the page, and does not fetch the user again", async () => {
    renderSession();
    await userEvent.click(await logOutButton());

    expect(
      await screen.findByRole("status", { name: "Signing out" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Log out", hidden: true }),
    ).not.toBeInTheDocument();
    // Only the first load: clearing the cache must not make the page ask who is signed in again.
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it("a failure keeps the user on the page, says they are still signed in and allows another try", async () => {
    logout.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    const client = renderSession();
    await userEvent.click(await logOutButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't log you out");
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(client.getQueryData(authQueryKeys.me)).toEqual(me);

    await userEvent.click(await logOutButton());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(logout).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
