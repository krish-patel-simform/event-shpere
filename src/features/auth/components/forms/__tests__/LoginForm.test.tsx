/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../../api/auth-api.service";
import { LoginForm } from "../LoginForm";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { login: jest.fn() },
}));
const login = jest.mocked(authApiService.login);

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(
  email = "ananya@example.com",
  password = "Secret123!",
) {
  await userEvent.type(screen.getByLabelText("Email address"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => login.mockReset());

describe("LoginForm", () => {
  it("shows field errors and does not call the API for an empty form", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("wrong details: shows the alert, keeps the email, clears the password, focuses the alert", async () => {
    login.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Invalid email or password"),
    );
    renderForm();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
    expect(alert).toHaveFocus();
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "ananya@example.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("not verified: shows the warning and keeps both values", async () => {
    login.mockRejectedValue(new ApiError(403, "EMAIL_NOT_VERIFIED", "x"));
    renderForm();
    await fillAndSubmit();

    expect(
      await screen.findByText("Verify your email first"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("Secret123!");
  });

  it("network failure: keeps the values and Try again resubmits them", async () => {
    login.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline"));
    renderForm();
    await fillAndSubmit();

    await userEvent.click(
      await screen.findByRole("button", { name: "Try again" }),
    );

    await waitFor(() => expect(login).toHaveBeenCalledTimes(2));
    expect(login).toHaveBeenLastCalledWith(
      { email: "ananya@example.com", password: "Secret123!" },
      expect.anything(),
    );
  });
});
