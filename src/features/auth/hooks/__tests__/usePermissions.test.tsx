/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../api/auth-api.service";
import { PermissionProvider } from "../../components/PermissionProvider";
import type { MeDto } from "../../schemas/auth.schemas";
import {
  useHasAllPermissions,
  useHasAnyPermission,
  useHasPermission,
  usePermissions,
} from "../usePermissions";

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
  permissions: ["EVENT_CREATE", "EVENT_MANAGE_OWN"],
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <PermissionProvider>{children}</PermissionProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getMe.mockReset();
  getMe.mockResolvedValue(me);
});

describe("usePermissions", () => {
  it("is loading and denies everything until the user has loaded", () => {
    getMe.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasPermission("EVENT_CREATE")).toBe(false);
    expect(result.current.hasAllPermissions([])).toBe(true);
  });

  it("answers from the loaded user's permissions", async () => {
    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPermission("EVENT_CREATE")).toBe(true);
    expect(result.current.hasPermission("USER_VIEW")).toBe(false);
    expect(
      result.current.hasAnyPermission(["USER_VIEW", "EVENT_MANAGE_OWN"]),
    ).toBe(true);
    expect(
      result.current.hasAllPermissions(["EVENT_CREATE", "USER_VIEW"]),
    ).toBe(false);
  });

  it("denies everything when the user could not be loaded", async () => {
    getMe.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Not signed in"),
    );
    const { result } = renderHook(() => usePermissions(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPermission("EVENT_CREATE")).toBe(false);
  });

  it("throws outside <PermissionProvider>, so a missing wrapper is not a silent 'no access'", () => {
    // React logs the thrown error; keep the test output clean.
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePermissions())).toThrow(
      "usePermissions must be used inside <PermissionProvider>",
    );
    jest.mocked(console.error).mockRestore();
  });
});

describe("useHas* hooks", () => {
  it("return plain booleans", async () => {
    const { result } = renderHook(
      () => ({
        create: useHasPermission("EVENT_CREATE"),
        viewUsers: useHasPermission("USER_VIEW"),
        any: useHasAnyPermission(["USER_VIEW", "EVENT_CREATE"]),
        all: useHasAllPermissions(["EVENT_CREATE", "EVENT_MANAGE_OWN"]),
        allWithMissing: useHasAllPermissions(["EVENT_CREATE", "USER_VIEW"]),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.create).toBe(true));
    expect(result.current).toEqual({
      create: true,
      viewUsers: false,
      any: true,
      all: true,
      allWithMissing: false,
    });
  });

  it("calls GET /api/auth/me once, however many hooks ask", async () => {
    const { result } = renderHook(
      () => [useHasPermission("EVENT_CREATE"), useHasPermission("POLL_VOTE")],
      { wrapper },
    );

    await waitFor(() => expect(result.current[0]).toBe(true));
    expect(getMe).toHaveBeenCalledTimes(1);
  });
});
