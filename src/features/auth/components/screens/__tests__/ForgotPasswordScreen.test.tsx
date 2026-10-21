/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordScreen } from "../ForgotPasswordScreen";

const emailField = () =>
  screen.getByLabelText("Email address", { selector: "input" });
const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

describe("ForgotPasswordScreen", () => {
  it("shows the heading, the email field and a link back to log in", () => {
    render(<ForgotPasswordScreen />);

    expect(
      screen.getByRole("heading", { name: "Reset your password" }),
    ).toBeInTheDocument();
    expect(emailField()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows an error and stays on the form when the email is empty", async () => {
    render(<ForgotPasswordScreen />);
    await submit();

    await waitFor(() =>
      expect(emailField()).toHaveAttribute("aria-invalid", "true"),
    );
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error and stays on the form when the email is malformed", async () => {
    render(<ForgotPasswordScreen />);
    await userEvent.type(emailField(), "not-an-email");
    await submit();

    await waitFor(() =>
      expect(emailField()).toHaveAttribute("aria-invalid", "true"),
    );
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).not.toBeInTheDocument();
  });

  it("a valid email shows 'Check your email' worded so it never confirms the account exists", async () => {
    render(<ForgotPasswordScreen />);
    await userEvent.type(emailField(), "olga@acme.test");
    await submit();

    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for/)).toBeInTheDocument();
    expect(screen.getByText("olga@acme.test")).toBeInTheDocument();
    expect(screen.getByText(/expires in 10 minutes/)).toBeInTheDocument();
  });

  it("'Use a different email' goes back to the form", async () => {
    render(<ForgotPasswordScreen />);
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
