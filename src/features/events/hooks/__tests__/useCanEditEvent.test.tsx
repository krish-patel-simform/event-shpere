/** @jest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { useHasPermission } from "@/src/features/auth";
import { useCanEditEvent } from "../useCanEditEvent";

jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const hasPermission = jest.mocked(useHasPermission);

const organizer = () => hasPermission.mockReturnValue(true);
// An admin holds EVENT_MANAGE_ALL (and SESSION_*), but not the organizer's EVENT_MANAGE_OWN.
const admin = () =>
  hasPermission.mockImplementation((code) => code !== "EVENT_MANAGE_OWN");

beforeEach(() => jest.resetAllMocks());

describe("useCanEditEvent", () => {
  it.each(["draft", "published"] as const)(
    "lets the organizer change a %s event",
    (status) => {
      organizer();
      expect(renderHook(() => useCanEditEvent(status)).result.current).toBe(
        true,
      );
    },
  );

  it.each(["completed", "cancelled"] as const)(
    "never lets anyone change a %s event",
    (status) => {
      organizer();
      expect(renderHook(() => useCanEditEvent(status)).result.current).toBe(
        false,
      );
    },
  );

  it.each(["draft", "published"] as const)(
    "never lets an admin change an organizer's %s event (view only)",
    (status) => {
      admin();
      expect(renderHook(() => useCanEditEvent(status)).result.current).toBe(
        false,
      );
      expect(hasPermission).toHaveBeenCalledWith("EVENT_MANAGE_OWN");
    },
  );
});
