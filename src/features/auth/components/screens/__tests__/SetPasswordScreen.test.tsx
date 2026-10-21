/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { authApiService } from "../../../api/auth-api.service";
import { SetPasswordScreen } from "../SetPasswordScreen";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { completeAccountSetup: jest.fn() },
}));
const completeAccountSetup = jest.mocked(authApiService.completeAccountSetup);

function renderScreen(token: string | null = "tok123") {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SetPasswordScreen token={token} />
    </QueryClientProvider>,
  );
}

const field = (label: string) =>
  screen.getByLabelText(label, { selector: "input" });

async function fillAndSubmit(password = "Secret123!", confirm = "Secret123!") {
  await userEvent.type(field("New password"), password);
  await userEvent.type(field("Confirm new password"), confirm);
  await userEvent.click(
    screen.getByRole("button", { name: "Activate account" }),
  );
}

beforeEach(() => completeAccountSetup.mockReset());

describe("SetPasswordScreen", () => {
  it("without a token: shows the expired-link state and no form", () => {
    renderScreen(null);

    expect(
      screen.getByRole("heading", { name: "This invitation link has expired" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to log in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("shows the invitation notice and the form", () => {
    renderScreen();
    expect(screen.getByText(/valid for 24 hours/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Set your password" }),
    ).toBeInTheDocument();
  });

  it("does not call the API when the passwords differ", async () => {
    renderScreen();
    await fillAndSubmit("Secret123!", "Different1!");

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(completeAccountSetup).not.toHaveBeenCalled();
  });

  it("sends the token and password, then shows 'Account activated'", async () => {
    completeAccountSetup.mockResolvedValue(undefined);
    renderScreen("tok123");
    await fillAndSubmit();

    expect(
      await screen.findByRole("heading", { name: "Account activated" }),
    ).toBeInTheDocument();
    expect(completeAccountSetup).toHaveBeenCalledWith(
      {
        token: "tok123",
        password: "Secret123!",
        confirmPassword: "Secret123!",
      },
      expect.anything(),
    );
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("an expired link from the server replaces the form with the expired state", async () => {
    completeAccountSetup.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad link", {
        token: ["This link is invalid or has expired"],
      }),
    );
    renderScreen();
    await fillAndSubmit();

    expect(
      await screen.findByRole("heading", {
        name: "This invitation link has expired",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("a server password error shows under the password field, not in the alert", async () => {
    completeAccountSetup.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad", {
        password: ["Too common"],
      }),
    );
    renderScreen();
    await fillAndSubmit();

    expect(await screen.findByText("Too common")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a network failure shows the alert, keeps the values and offers Try again", async () => {
    completeAccountSetup.mockRejectedValue(
      new ApiError(0, "NETWORK_ERROR", "offline"),
    );
    renderScreen();
    await fillAndSubmit();

    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(field("New password")).toHaveValue("Secret123!");
  });
});
