/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  selectPendingVerification,
  verificationStarted,
} from "@/src/redux/slices/auth-flow.slice";
import { makeStore } from "@/src/redux/store";
import { renderWithStoreAndQuery } from "@/src/redux/test-utils";
import { authApiService } from "../../../api/auth-api.service";
import { VerifyEmailForm } from "../../forms/VerifyEmailForm";
import { ProgressTracker } from "../../preview/ProgressTracker";
import { VerifyEmailScreen } from "../VerifyEmailScreen";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { verifyEmail: jest.fn() },
}));
const verifyEmail = jest.mocked(authApiService.verifyEmail);

beforeEach(() => {
  verifyEmail.mockReset();
  verifyEmail.mockResolvedValue(undefined);
});

const code = () => screen.getByLabelText("Verification code");
const submit = () =>
  userEvent.click(
    screen.getByRole("button", { name: /Verify email|Verifying/ }),
  );

/** The form on its own: it needs only React Query (no Redux). */
function renderForm(
  props: Partial<Parameters<typeof VerifyEmailForm>[0]> = {},
) {
  const onVerified = jest.fn();
  const onLinkInvalid = jest.fn();
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <VerifyEmailForm
        token="t"
        onVerified={onVerified}
        onLinkInvalid={onLinkInvalid}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onVerified, onLinkInvalid };
}

describe("VerifyEmailForm", () => {
  it("keeps only digits while typing, up to 6", async () => {
    renderForm();
    await userEvent.type(code(), "12a-3 456789");
    expect(code()).toHaveValue("123456");
  });

  it("asks for 6 digits when the code is too short, without calling the API", async () => {
    const { onVerified } = renderForm();
    await userEvent.type(code(), "123");
    await submit();

    expect(
      await screen.findByText("Enter the 6-digit code"),
    ).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("sends the link's token and the code, then calls onVerified", async () => {
    const { onVerified } = renderForm({ token: "tok123" });
    await userEvent.type(code(), "482913");
    await submit();

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail.mock.calls[0][0]).toEqual({
      token: "tok123",
      otp: "482913",
    });
  });

  it("disables the button and the field while the request is pending", async () => {
    verifyEmail.mockReturnValue(new Promise(() => {}));
    const { onVerified } = renderForm();
    await userEvent.type(code(), "482913");
    await submit();

    const button = await screen.findByRole("button", { name: /Verifying/ });
    expect(button).toBeDisabled();
    expect(code()).toHaveAttribute("readonly");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("a wrong or expired code shows under the field, stays editable and is not an alert", async () => {
    verifyEmail.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad code", {
        otp: ["The code is incorrect or has expired."],
      }),
    );
    const { onVerified, onLinkInvalid } = renderForm();
    await userEvent.type(code(), "000000");
    await submit();

    expect(
      await screen.findByText("The code is incorrect or has expired."),
    ).toBeInTheDocument();
    expect(code()).toHaveAttribute("aria-invalid", "true");
    expect(code()).not.toHaveAttribute("readonly");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
    expect(onLinkInvalid).not.toHaveBeenCalled();
  });

  it("an expired or used link from the server calls onLinkInvalid", async () => {
    verifyEmail.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad link", {
        token: ["This link is invalid or has expired"],
      }),
    );
    const { onVerified, onLinkInvalid } = renderForm();
    await userEvent.type(code(), "482913");
    await submit();

    await waitFor(() => expect(onLinkInvalid).toHaveBeenCalledTimes(1));
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("a rate-limited request shows the server's message in the alert", async () => {
    verifyEmail.mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later."),
    );
    const { onVerified } = renderForm();
    await userEvent.type(code(), "482913");
    await submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many requests. Try again later.");
    expect(alert).toHaveFocus();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("a network failure shows a retryable alert, keeps the code, and 'Try again' resubmits", async () => {
    verifyEmail.mockRejectedValueOnce(
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
    );
    const { onVerified } = renderForm();
    await userEvent.type(code(), "482913");
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong",
    );
    expect(code()).toHaveValue("482913");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(verifyEmail).toHaveBeenCalledTimes(2);
  });

  it("uses the one-time-code autofill hints", () => {
    renderForm();
    expect(code()).toHaveAttribute("autocomplete", "one-time-code");
    expect(code()).toHaveAttribute("inputmode", "numeric");
  });
});

describe("VerifyEmailScreen", () => {
  const invalidLinkHeading = () =>
    screen.queryByRole("heading", {
      name: "This link is invalid or has expired",
    });

  it("without a token: shows the invalid-link state and no form", () => {
    renderWithStoreAndQuery(<VerifyEmailScreen token={null} />);

    expect(invalidLinkHeading()).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Verification code"),
    ).not.toBeInTheDocument();
    // The "Back to log in" link is in the top bar and in the panel.
    expect(
      screen.getAllByRole("link", { name: "Back to log in" }).length,
    ).toBeGreaterThan(0);
  });

  it("with a token: shows the code form", () => {
    renderWithStoreAndQuery(<VerifyEmailScreen token="abc" />);
    expect(
      screen.getByRole("heading", { name: "Verify your email" }),
    ).toBeInTheDocument();
  });

  it("after a good code: shows 'Email verified' and forgets the stored email", async () => {
    const store = makeStore();
    store.dispatch(
      verificationStarted({
        email: "ananya@example.com",
        verificationEmailSent: true,
        expiresInMinutes: 5,
      }),
    );
    renderWithStoreAndQuery(<VerifyEmailScreen token="abc" />, store);

    await userEvent.type(code(), "482913");
    await submit();

    expect(
      await screen.findByRole("heading", { name: "Email verified" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText("Applied as an organizer?")).toBeInTheDocument();
    expect(selectPendingVerification(store.getState())).toBeNull();
  });

  it("a wrong code keeps the form and keeps the stored email", async () => {
    verifyEmail.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad code", {
        otp: ["The code is incorrect or has expired."],
      }),
    );
    const store = makeStore();
    store.dispatch(
      verificationStarted({
        email: "ananya@example.com",
        verificationEmailSent: true,
        expiresInMinutes: 5,
      }),
    );
    renderWithStoreAndQuery(<VerifyEmailScreen token="abc" />, store);

    await userEvent.type(code(), "000000");
    await submit();

    expect(
      await screen.findByText("The code is incorrect or has expired."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Email verified" }),
    ).not.toBeInTheDocument();
    expect(selectPendingVerification(store.getState())).not.toBeNull();
  });

  it("an expired or used link from the server replaces the form with the invalid-link state", async () => {
    verifyEmail.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "bad link", {
        token: ["This link is invalid or has expired"],
      }),
    );
    renderWithStoreAndQuery(<VerifyEmailScreen token="abc" />);

    await userEvent.type(code(), "482913");
    await submit();

    expect(
      await screen.findByRole("heading", {
        name: "This link is invalid or has expired",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Verification code"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Email verified" }),
    ).not.toBeInTheDocument();
  });
});

describe("ProgressTracker", () => {
  it("marks the current step and announces finished ones", () => {
    render(
      <ProgressTracker
        heading="Your progress"
        steps={[
          { title: "Account created", status: "done" },
          {
            title: "Verify your email",
            description: "In progress",
            status: "current",
          },
          { title: "Log in", status: "upcoming" },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("Completed.");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });
});
