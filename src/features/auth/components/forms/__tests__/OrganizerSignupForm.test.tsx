/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { selectPendingVerification } from "@/src/redux/slices/auth-flow.slice";
import { renderWithStoreAndQuery } from "@/src/redux/test-utils";
import { authApiService } from "../../../api/auth-api.service";
import type { OrganizerSignUpResponseDto } from "../../../schemas/auth.schemas";
import { OrganizerSignupForm } from "../OrganizerSignupForm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { signUpOrganizer: jest.fn() },
}));
const signUpOrganizer = jest.mocked(authApiService.signUpOrganizer);

const createdOrganizer: OrganizerSignUpResponseDto = {
  id: "6c2f9f0e-1d3b-4a55-8a11-0d4c7b1f2e33",
  userId: "0b0f6a1e-6a0d-4f6e-9a55-1f6f2f0f9a11",
  firstName: "Ananya",
  lastName: "Rao",
  email: "ananya@acme.com",
  status: "pending",
  organizationName: "Acme Events",
  organizationWebsite: null,
  isVerified: false,
  createdAt: "2026-10-21T10:00:00.000Z",
  verificationEmailSent: true,
  verificationCodeExpiresInMinutes: 5,
};

beforeEach(() => {
  mockPush.mockReset();
  signUpOrganizer.mockReset();
  signUpOrganizer.mockResolvedValue(createdOrganizer);
});

const submitButton = () =>
  screen.getByRole("button", {
    name: /Submit application|Submitting application/,
  });

async function fillRequired(overrides: { confirm?: string } = {}) {
  await userEvent.type(screen.getByLabelText("First name"), "Ananya");
  await userEvent.type(screen.getByLabelText("Last name"), "Rao");
  await userEvent.type(screen.getByLabelText("Work email"), "ananya@acme.com");
  await userEvent.type(
    screen.getByLabelText("Organisation name"),
    "Acme Events",
  );
  await userEvent.type(
    screen.getByLabelText("Password", { selector: "input" }),
    "Secret123!",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm password"),
    overrides.confirm ?? "Secret123!",
  );
}

describe("OrganizerSignupForm", () => {
  it("groups the fields under the three headings from the design", () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    for (const name of ["About you", "Your organisation", "Password"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("shows required-field errors on submit and does not call the API", async () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Organization name is required"),
    ).toBeInTheDocument();
    expect(signUpOrganizer).not.toHaveBeenCalled();
  });

  it("sends only the filled fields when the website is left empty", async () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    await waitFor(() => expect(signUpOrganizer).toHaveBeenCalledTimes(1));
    // An empty optional website counts as "not provided": not sent, not an invalid URL.
    expect(signUpOrganizer.mock.calls[0][0]).toEqual({
      firstName: "Ananya",
      lastName: "Rao",
      email: "ananya@acme.com",
      organizationName: "Acme Events",
      password: "Secret123!",
      confirmPassword: "Secret123!",
    });
    expect(screen.queryByText(/Use a full http/)).not.toBeInTheDocument();
  });

  it("sends the website when it is filled in", async () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.type(
      screen.getByLabelText(/Website/),
      "https://acme.example",
    );
    await userEvent.click(submitButton());

    await waitFor(() => expect(signUpOrganizer).toHaveBeenCalledTimes(1));
    expect(signUpOrganizer.mock.calls[0][0]).toMatchObject({
      organizationWebsite: "https://acme.example",
    });
  });

  it("rejects a website that is not an http(s) URL and does not call the API", async () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.type(
      screen.getByLabelText(/Website/),
      "javascript:alert(1)",
    );
    await userEvent.click(submitButton());

    expect(await screen.findByText(/Use a full http/)).toBeInTheDocument();
    expect(signUpOrganizer).not.toHaveBeenCalled();
  });

  it("shows 'Passwords do not match' under the confirm field and does not call the API", async () => {
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired({ confirm: "Different1!" });
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(signUpOrganizer).not.toHaveBeenCalled();
  });

  it("on success remembers the address from the response and goes to check-email", async () => {
    signUpOrganizer.mockResolvedValue({
      ...createdOrganizer,
      verificationEmailSent: false,
      verificationCodeExpiresInMinutes: 10,
    });
    const { store } = renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(selectPendingVerification(store.getState())).toEqual({
      email: "ananya@acme.com",
      verificationEmailSent: false,
      expiresInMinutes: 10,
    });
  });

  it("disables the button and the fields while the request is pending", async () => {
    signUpOrganizer.mockReturnValue(new Promise(() => {}));
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    const button = await screen.findByRole("button", {
      name: /Submitting application/,
    });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Work email")).toHaveAttribute("readonly");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a taken email shows under the email field, keeps every value and does not leave the page", async () => {
    signUpOrganizer.mockRejectedValue(
      new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );
    const { store } = renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("An account with this email already exists"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Organisation name")).toHaveValue(
      "Acme Events",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(selectPendingVerification(store.getState())).toBeNull();
  });

  it("a field error from the server shows under that field, not in the alert", async () => {
    signUpOrganizer.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "Invalid input", {
        organizationName: ["Organization name is too long"],
      }),
    );
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("Organization name is too long"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a rate-limited request shows the server's message in the alert", async () => {
    signUpOrganizer.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
    );
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many requests. Try again later.");
    expect(alert).toHaveFocus();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a network failure shows a retryable alert, keeps the values, and 'Try again' resubmits", async () => {
    signUpOrganizer.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    renderWithStoreAndQuery(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(screen.getByLabelText("Work email")).toHaveValue("ananya@acme.com");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(signUpOrganizer).toHaveBeenCalledTimes(2);
  });
});
