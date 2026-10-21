/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../../api/auth-api.service";
import { ResetPasswordScreen } from "../ResetPasswordScreen";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { resetPassword: jest.fn() },
}));
const resetPassword = jest.mocked(authApiService.resetPassword);

function renderScreen(token: string | null = "tok123") {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ResetPasswordScreen token={token} />
    </QueryClientProvider>,
  );
}

const field = (label: string) =>
  screen.getByLabelText(label, { selector: "input" });
const invalidLinkHeading = () =>
  screen.queryByRole("heading", {
    name: "This reset link is invalid or has expired",
  });
const updatedHeading = () =>
  screen.queryByRole("heading", { name: "Password updated" });

async function fillAndSubmit(password = "Secret123!", confirm = "Secret123!") {
  await userEvent.type(field("New password"), password);
  await userEvent.type(field("Confirm new password"), confirm);
  await userEvent.click(
    screen.getByRole("button", { name: /Reset password|Resetting/ }),
  );
}

beforeEach(() => {
  resetPassword.mockReset();
  resetPassword.mockResolvedValue(undefined);
});

describe("ResetPasswordScreen", () => {
  it("without a token: shows the invalid-link state, no form, and a way to request a new link", () => {
    renderScreen(null);

    expect(invalidLinkHeading()).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Back to log in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("with a token: shows the expiry notice and the form", () => {
    renderScreen();

    expect(screen.getByText(/valid for 10 minutes/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });

  it("shows the password rule error and does not call the API when the password is weak", async () => {
    renderScreen();
    await fillAndSubmit("weak", "weak");

    expect(updatedHeading()).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("shows 'Passwords do not match' and does not call the API when the two differ", async () => {
    renderScreen();
    await fillAndSubmit("Secret123!", "Different1!");

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(updatedHeading()).not.toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("sends the token and password, then shows 'Password updated' with a link to log in", async () => {
    renderScreen("tok123");
    await fillAndSubmit();

    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword.mock.calls[0][0]).toEqual({
      token: "tok123",
      password: "Secret123!",
      confirmPassword: "Secret123!",
    });
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("disables the button and the fields while the request is pending", async () => {
    resetPassword.mockReturnValue(new Promise(() => {}));
    renderScreen();
    await fillAndSubmit();

    const button = await screen.findByRole("button", { name: /Resetting/ });
    expect(button).toBeDisabled();
    expect(field("New password")).toHaveAttribute("readonly");
    expect(updatedHeading()).not.toBeInTheDocument();
  });

  it("an expired or used link from the server replaces the form with the invalid-link state", async () => {
    resetPassword.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad link", {
        token: ["This link is invalid or has expired"],
      }),
    );
    renderScreen();
    await fillAndSubmit();

    expect(
      await screen.findByRole("heading", {
        name: "This reset link is invalid or has expired",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("'same as current password' shows under the password field, not in the alert", async () => {
    resetPassword.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "same", {
        password: ["Choose a password you have not used before"],
      }),
    );
    renderScreen();
    await fillAndSubmit();

    expect(
      await screen.findByText("Choose a password you have not used before"),
    ).toBeInTheDocument();
    expect(field("New password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(updatedHeading()).not.toBeInTheDocument();
  });

  it("a network failure shows a retryable alert, keeps the values, and 'Try again' resubmits", async () => {
    resetPassword.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "offline"),
    );
    renderScreen();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveFocus();
    expect(field("New password")).toHaveValue("Secret123!");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledTimes(2);
  });

  it("a rate-limited request shows the server's message in the alert", async () => {
    resetPassword.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
    );
    renderScreen();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many requests. Try again later.",
    );
    expect(updatedHeading()).not.toBeInTheDocument();
  });
});
