/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../api/auth-api.service";
import type { MeDto } from "../../schemas/auth.schemas";
import { PermissionGate } from "../PermissionGate";
import { PermissionProvider } from "../PermissionProvider";

jest.mock("../../api/auth-api.service", () => ({
  authApiService: { getMe: jest.fn() },
}));
const getMe = jest.mocked(authApiService.getMe);

const me: MeDto = {
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@example.com",
  role: "organizer",
  permissions: ["EVENT_CREATE", "ANALYTICS_VIEW_EVENT"],
};

function renderGate(gate: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PermissionProvider>{gate}</PermissionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getMe.mockReset();
  getMe.mockResolvedValue(me);
});

describe("PermissionGate", () => {
  it("shows a loading state, not the page, while the user loads", () => {
    getMe.mockReturnValue(new Promise(() => {}));
    renderGate(
      <PermissionGate>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("Private page")).not.toBeInTheDocument();
  });

  it("a guest who opens the URL is asked to log in", async () => {
    getMe.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Not signed in"),
    );
    renderGate(
      <PermissionGate>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(await screen.findByText("Log in to continue")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByText("Private page")).not.toBeInTheDocument();
  });

  it("a signed-in user without the permission sees 'no access', not 'log in'", async () => {
    renderGate(
      <PermissionGate permissions={["ANALYTICS_VIEW_ALL"]}>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(
      await screen.findByText("You don't have access"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Log in to continue")).not.toBeInTheDocument();
    expect(screen.queryByText("Private page")).not.toBeInTheDocument();
  });

  it("shows the page with every required permission", async () => {
    renderGate(
      <PermissionGate permissions={["EVENT_CREATE", "ANALYTICS_VIEW_EVENT"]}>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(await screen.findByText("Private page")).toBeInTheDocument();
  });

  it("'all' (default) needs every code; one missing closes the page", async () => {
    renderGate(
      <PermissionGate permissions={["EVENT_CREATE", "ANALYTICS_VIEW_ALL"]}>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(
      await screen.findByText("You don't have access"),
    ).toBeInTheDocument();
  });

  it("'any' needs only one of the codes", async () => {
    renderGate(
      <PermissionGate
        permissions={["EVENT_CREATE", "ANALYTICS_VIEW_ALL"]}
        match="any"
      >
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(await screen.findByText("Private page")).toBeInTheDocument();
  });

  it("with no permissions listed, any signed-in user gets the page", async () => {
    getMe.mockResolvedValue({ ...me, permissions: [] });
    renderGate(
      <PermissionGate>
        <p>Private page</p>
      </PermissionGate>,
    );

    expect(await screen.findByText("Private page")).toBeInTheDocument();
  });
});
