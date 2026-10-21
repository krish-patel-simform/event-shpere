/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { selectPendingVerification } from "@/src/redux/slices/auth-flow.slice";
import { renderWithStoreAndQuery } from "@/src/redux/test-utils";
import { authApiService } from "../../../api/auth-api.service";
import type { UserSignUpResponseDto } from "../../../schemas/auth.schemas";
import { UserSignupForm } from "../UserSignupForm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { signUpUser: jest.fn() },
}));
const signUpUser = jest.mocked(authApiService.signUpUser);

const createdAccount: UserSignUpResponseDto = {
  userId: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@example.com",
  status: "pending",
  phone: null,
  city: null,
  postalCode: null,
  avatarUrl: null,
  isVerified: false,
  verificationEmailSent: true,
  verificationCodeExpiresInMinutes: 5,
};

beforeEach(() => {
  mockPush.mockReset();
  signUpUser.mockReset();
  signUpUser.mockResolvedValue(createdAccount);
});

const submitButton = () =>
  screen.getByRole("button", { name: /Create account|Creating account/ });

async function fillRequired(
  overrides: { password?: string; confirm?: string } = {},
) {
  await userEvent.type(screen.getByLabelText("First name"), "Ananya");
  await userEvent.type(screen.getByLabelText("Last name"), "Rao");
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "ananya@example.com",
  );
  await userEvent.type(
    screen.getByLabelText("Password"),
    overrides.password ?? "Secret123!",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm password"),
    overrides.confirm ?? "Secret123!",
  );
}

describe("UserSignupForm", () => {
  it("shows required-field errors on submit and does not call the API", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(signUpUser).not.toHaveBeenCalled();
  });

  it("does not ask for a profile photo at signup", () => {
    renderWithStoreAndQuery(<UserSignupForm />);

    expect(screen.queryByLabelText(/Profile photo/)).not.toBeInTheDocument();
  });

  it("sends only the filled fields when every optional field is left empty", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    await waitFor(() => expect(signUpUser).toHaveBeenCalledTimes(1));
    // Empty optional boxes count as "not provided": not sent, not an invalid phone.
    expect(signUpUser.mock.calls[0][0]).toEqual({
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya@example.com",
      password: "Secret123!",
      confirmPassword: "Secret123!",
    });
    expect(screen.queryByText(/valid phone number/)).not.toBeInTheDocument();
  });

  it("sends the optional details when they are filled in", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Phone/), "555-123-4567");
    await userEvent.type(screen.getByLabelText(/City/), "Pune");
    await userEvent.type(screen.getByLabelText(/Postal code/), "411001");
    await userEvent.click(submitButton());

    await waitFor(() => expect(signUpUser).toHaveBeenCalledTimes(1));
    expect(signUpUser.mock.calls[0][0]).toMatchObject({
      phone: "555-123-4567",
      city: "Pune",
      postalCode: "411001",
    });
  });

  it("rejects a badly formatted phone number and does not call the API", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Phone/), "12");
    await userEvent.click(submitButton());

    expect(await screen.findByText(/valid phone number/)).toBeInTheDocument();
    expect(signUpUser).not.toHaveBeenCalled();
  });

  it("shows 'Passwords do not match' under the confirm field and does not call the API", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired({ confirm: "Different1!" });
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(signUpUser).not.toHaveBeenCalled();
  });

  it("updates the password checklist while typing", async () => {
    renderWithStoreAndQuery(<UserSignupForm />);
    const list = screen.getByRole("list", { name: "Password requirements" });
    expect(list).toHaveTextContent("A number (not met)");

    await userEvent.type(screen.getByLabelText("Password"), "abc1");
    expect(list).toHaveTextContent("A number (met)");
    expect(list).toHaveTextContent("A lowercase letter (met)");
    expect(list).toHaveTextContent("An uppercase letter (not met)");
  });

  it("on success remembers the address from the response and goes to check-email", async () => {
    signUpUser.mockResolvedValue({
      ...createdAccount,
      verificationEmailSent: false,
      verificationCodeExpiresInMinutes: 10,
    });
    const { store } = renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(selectPendingVerification(store.getState())).toEqual({
      email: "ananya@example.com",
      verificationEmailSent: false,
      expiresInMinutes: 10,
    });
  });

  it("disables the button and the fields while the request is pending", async () => {
    signUpUser.mockReturnValue(new Promise(() => {}));
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    const button = await screen.findByRole("button", {
      name: /Creating account/,
    });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a taken email shows under the email field, keeps every value and does not leave the page", async () => {
    signUpUser.mockRejectedValue(
      new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );
    const { store } = renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("An account with this email already exists"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Ananya");
    expect(screen.getByLabelText("Password")).toHaveValue("Secret123!");
    expect(mockPush).not.toHaveBeenCalled();
    expect(selectPendingVerification(store.getState())).toBeNull();
  });

  it("a field error from the server shows under that field, not in the alert", async () => {
    signUpUser.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Invalid input", {
        phone: ["Enter a valid phone number"],
      }),
    );
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("Enter a valid phone number"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a rate-limited request shows the server's message in the alert", async () => {
    signUpUser.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
    );
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many requests. Try again later.");
    expect(alert).toHaveFocus();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a network failure shows a retryable alert, keeps the values, and 'Try again' resubmits", async () => {
    signUpUser.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderWithStoreAndQuery(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "ananya@example.com",
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(signUpUser).toHaveBeenCalledTimes(2);
  });
});
