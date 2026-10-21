/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeStore } from "@/src/redux/store";
import { renderWithStore } from "@/src/redux/test-utils";
import { VerifyEmailForm } from "../components/forms/VerifyEmailForm";
import { ProgressTracker } from "../components/preview/ProgressTracker";
import { VerifyEmailScreen } from "../components/screens/VerifyEmailScreen";
import { selectPendingVerification, verificationStarted } from "@/src/redux/slices/auth-flow.slice";

const code = () => screen.getByLabelText("Verification code");
const submit = () => userEvent.click(screen.getByRole("button", { name: "Verify email" }));

describe("VerifyEmailForm", () => {
  it("keeps only digits while typing, up to 6", async () => {
    render(<VerifyEmailForm token="t" onVerified={jest.fn()} />);
    await userEvent.type(code(), "12a-3 456789");
    expect(code()).toHaveValue("123456");
  });

  it("asks for 6 digits when the code is too short, without verifying", async () => {
    const onVerified = jest.fn();
    render(<VerifyEmailForm token="t" onVerified={onVerified} />);
    await userEvent.type(code(), "123");
    await submit();

    expect(await screen.findByText("Enter the 6-digit code")).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("shows the wrong-code message under the field and stays editable", async () => {
    const onVerified = jest.fn();
    render(<VerifyEmailForm token="t" onVerified={onVerified} />);
    await userEvent.type(code(), "000000");
    await submit();

    expect(await screen.findByText(/The code is incorrect or has expired/)).toBeInTheDocument();
    expect(code()).toHaveAttribute("aria-invalid", "true");
    expect(code()).not.toHaveAttribute("readonly");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("calls onVerified for an accepted code", async () => {
    const onVerified = jest.fn();
    render(<VerifyEmailForm token="t" onVerified={onVerified} />);
    await userEvent.type(code(), "482913");
    await submit();

    await screen.findByRole("button", { name: "Verify email" });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("uses the one-time-code autofill hints", () => {
    render(<VerifyEmailForm token="t" onVerified={jest.fn()} />);
    expect(code()).toHaveAttribute("autocomplete", "one-time-code");
    expect(code()).toHaveAttribute("inputmode", "numeric");
  });
});

describe("VerifyEmailScreen", () => {
  it("without a token: shows the invalid-link state and no form", () => {
    renderWithStore(<VerifyEmailScreen token={null} />);

    expect(screen.getByRole("heading", { name: "This link is invalid or has expired" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    // The "Back to log in" link is in the top bar and in the panel.
    expect(screen.getAllByRole("link", { name: "Back to log in" }).length).toBeGreaterThan(0);
  });

  it("with a token: shows the code form", () => {
    renderWithStore(<VerifyEmailScreen token="abc" />);
    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
  });

  it("after a good code: shows 'Email verified' and forgets the stored email", async () => {
    const store = makeStore();
    store.dispatch(
      verificationStarted({ email: "ananya@example.com", verificationEmailSent: true, expiresInMinutes: 5 }),
    );
    renderWithStore(<VerifyEmailScreen token="abc" />, store);

    await userEvent.type(code(), "482913");
    await submit();

    expect(await screen.findByRole("heading", { name: "Email verified" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByText("Applied as an organizer?")).toBeInTheDocument();
    expect(selectPendingVerification(store.getState())).toBeNull();
  });
});

describe("ProgressTracker", () => {
  it("marks the current step and announces finished ones", () => {
    render(
      <ProgressTracker
        heading="Your progress"
        steps={[
          { title: "Account created", status: "done" },
          { title: "Verify your email", description: "In progress", status: "current" },
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
