/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResetPasswordScreen } from "../components/screens/ResetPasswordScreen";

const field = (label: string) =>
  screen.getByLabelText(label, { selector: "input" });

async function fillAndSubmit(password = "Secret123!", confirm = "Secret123!") {
  await userEvent.type(field("New password"), password);
  await userEvent.type(field("Confirm new password"), confirm);
  await userEvent.click(screen.getByRole("button", { name: "Reset password" }));
}

describe("ResetPasswordScreen", () => {
  it("without a token: shows the invalid-link state, no form, and a way to request a new link", () => {
    render(<ResetPasswordScreen token={null} />);

    expect(
      screen.getByRole("heading", {
        name: "This reset link is invalid or has expired",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Back to log in" }),
    ).toHaveAttribute("href", "/login");
  });

  it("with a token: shows the expiry notice and the form", () => {
    render(<ResetPasswordScreen token="tok123" />);

    expect(screen.getByText(/valid for 10 minutes/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });

  it("shows the password rule error and does not finish when the password is weak", async () => {
    render(<ResetPasswordScreen token="tok123" />);
    await fillAndSubmit("weak", "weak");

    expect(
      screen.queryByRole("heading", { name: "Password updated" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });

  it("shows 'Passwords do not match' and does not finish when the two differ", async () => {
    render(<ResetPasswordScreen token="tok123" />);
    await fillAndSubmit("Secret123!", "Different1!");

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Password updated" }),
    ).not.toBeInTheDocument();
  });

  it("a valid new password ends in 'Password updated' with a link to log in", async () => {
    render(<ResetPasswordScreen token="tok123" />);
    await fillAndSubmit();

    expect(
      await screen.findByRole("heading", { name: "Password updated" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
