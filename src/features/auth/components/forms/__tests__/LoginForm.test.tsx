/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../../api/auth-api.service";
import { authQueryKeys } from "../../../hooks/useMe";
import type { AuthUserDto } from "../../../schemas/auth.schemas";
import { LoginForm } from "../LoginForm";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { login: jest.fn() },
}));
const login = jest.mocked(authApiService.login);

const signedIn: AuthUserDto = {
  id: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@example.com",
  role: "admin",
};

function renderForm() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LoginForm />
    </QueryClientProvider>,
  );
  return client;
}

async function fillAndSubmit(
  email = "ananya@example.com",
  password = "Secret123!",
) {
  await userEvent.type(screen.getByLabelText("Email address"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

beforeEach(() => {
  login.mockReset();
  mockReplace.mockReset();
});

describe("LoginForm: success", () => {
  it("goes to the dashboard after a successful login, whatever the role", async () => {
    login.mockResolvedValue(signedIn);
    renderForm();
    await fillAndSubmit();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(login).toHaveBeenCalledTimes(1);
    // The old "Signed in as ..." placeholder is gone: the redirect is the only feedback.
    expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
  });

  it("does not go anywhere before the server has accepted the login", async () => {
    login.mockReturnValue(new Promise(() => {}));
    renderForm();
    await fillAndSubmit();

    await screen.findByRole("button", { name: "Logging in…" });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("keeps the form disabled between success and the page change, so it cannot be sent twice", async () => {
    login.mockResolvedValue(signedIn);
    renderForm();
    await fillAndSubmit();

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Logging in…" })).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
  });

  it("forgets anything cached for a previous session (e.g. the old signed-in user)", async () => {
    login.mockResolvedValue(signedIn);
    const client = renderForm();
    client.setQueryData(authQueryKeys.me, { id: "previous-user" });
    await fillAndSubmit();

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(client.getQueryData(authQueryKeys.me)).toBeUndefined();
  });

  it("does not redirect or clear the cache when the login fails", async () => {
    login.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Invalid email or password"),
    );
    const client = renderForm();
    client.setQueryData(authQueryKeys.me, { id: "previous-user" });
    await fillAndSubmit();

    await screen.findByRole("alert");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(client.getQueryData(authQueryKeys.me)).toEqual({
      id: "previous-user",
    });
  });
});

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
