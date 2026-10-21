/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../../api/auth-api.service";
import { ForgotPasswordScreen } from "../ForgotPasswordScreen";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { forgotPassword: jest.fn() },
}));
const forgotPassword = jest.mocked(authApiService.forgotPassword);

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ForgotPasswordScreen />
    </QueryClientProvider>,
  );
}

const emailField = () =>
  screen.getByLabelText("Email address", { selector: "input" });
const submit = () =>
  userEvent.click(
    screen.getByRole("button", { name: /Send reset link|Sending/ }),
  );
const checkEmailHeading = () =>
  screen.queryByRole("heading", { name: "Check your email" });

beforeEach(() => {
  forgotPassword.mockReset();
  forgotPassword.mockResolvedValue(undefined);
});

describe("ForgotPasswordScreen", () => {
  it("shows the heading, the email field and a link back to log in", () => {
    renderScreen();

    expect(
      screen.getByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows an error and does not call the API when the email is empty", async () => {
    renderScreen();
    await submit();

    await waitFor(() =>
      expect(emailField()).toHaveAttribute("aria-invalid", "true"),
    );
    expect(checkEmailHeading()).not.toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("shows an error and does not call the API when the email is malformed", async () => {
    renderScreen();
    await userEvent.type(emailField(), "not-an-email");
    await submit();

    await waitFor(() =>
      expect(emailField()).toHaveAttribute("aria-invalid", "true"),
    );
    expect(checkEmailHeading()).not.toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it("sends the email to the API and shows 'Check your email' worded so it never confirms the account exists", async () => {
    renderScreen();
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(forgotPassword).toHaveBeenCalledTimes(1);
    expect(forgotPassword.mock.calls[0][0]).toEqual({
      email: "olga@acme.test",
    });
    expect(screen.getByText(/If an account exists for/)).toBeInTheDocument();
    expect(screen.getByText("olga@acme.test")).toBeInTheDocument();
    expect(screen.getByText(/expires in 10 minutes/)).toBeInTheDocument();
  });

  it("disables the button and the field while the request is pending", async () => {
    forgotPassword.mockReturnValue(new Promise(() => {}));
    renderScreen();
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();

    const button = await screen.findByRole("button", { name: /Sending/ });
    expect(button).toBeDisabled();
    expect(emailField()).toHaveAttribute("readonly");
    expect(checkEmailHeading()).not.toBeInTheDocument();
  });

  it("shows the server's message under the field when the email is rejected (admin account)", async () => {
    forgotPassword.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Admin passwords cannot be reset", {
        email: ["Admin passwords cannot be reset by email."],
      }),
    );
    renderScreen();
    await userEvent.type(emailField(), "admin@acme.test");
    await submit();

    expect(
      await screen.findByText("Admin passwords cannot be reset by email."),
    ).toBeInTheDocument();
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(checkEmailHeading()).not.toBeInTheDocument();
  });

  it("shows the server's message when the request is rate limited", async () => {
    forgotPassword.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
    );
    renderScreen();
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many requests. Try again later.");
    expect(alert).toHaveFocus();
    expect(emailField()).toHaveValue("olga@acme.test");
    expect(checkEmailHeading()).not.toBeInTheDocument();
  });

  it("a network failure shows a retryable alert, and 'Try again' resubmits the same email", async () => {
    forgotPassword.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderScreen();
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(emailField()).toHaveValue("olga@acme.test");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(forgotPassword).toHaveBeenCalledTimes(2);
    expect(forgotPassword.mock.calls[1][0]).toEqual({
      email: "olga@acme.test",
    });
  });

  it("'Use a different email' goes back to the form", async () => {
    renderScreen();
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();
    await userEvent.click(
      await screen.findByRole("button", { name: "Use a different email" }),
    );

    expect(
      screen.getByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
  });
});
