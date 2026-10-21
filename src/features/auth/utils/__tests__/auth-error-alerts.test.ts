import { ApiError } from "@/src/core/api-client/base-api.service";
import { getAuthAlert } from "../auth-error-alerts";

describe("getAuthAlert", () => {
  it.each([
    ["UNAUTHENTICATED", 401, "error"],
    ["EMAIL_NOT_VERIFIED", 403, "warning"],
    ["PASSWORD_NOT_SET", 403, "info"],
    ["ACCOUNT_SUSPENDED", 403, "error"],
  ])("maps %s to its own tone", (code, status, tone) => {
    expect(getAuthAlert(new ApiError(status, code, "server text")).tone).toBe(
      tone,
    );
  });

  it("offers a retry for network failures and 5xx", () => {
    expect(
      getAuthAlert(new ApiError(0, "NETWORK_ERROR", "offline")).retryable,
    ).toBe(true);
    expect(getAuthAlert(new ApiError(503, "UNKNOWN", "x")).retryable).toBe(
      true,
    );
  });

  it("shows the server message for other 4xx errors, without a retry", () => {
    const alert = getAuthAlert(
      new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );
    expect(alert).toEqual({
      tone: "error",
      message: "An account with this email already exists",
    });
  });

  it("links to support only for a suspended account", () => {
    expect(
      getAuthAlert(new ApiError(403, "ACCOUNT_SUSPENDED", "x")).supportLink,
    ).toBe(true);
    expect(
      getAuthAlert(new ApiError(401, "UNAUTHENTICATED", "x")).supportLink,
    ).toBeUndefined();
  });
});
