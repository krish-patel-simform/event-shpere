/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert, Button, PasswordField, TextField } from "..";

describe("TextField", () => {
  it("connects label, hint and error to the input", () => {
    render(<TextField label="Email address" hint="Work email" error="Invalid email" />);

    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Work email Invalid email");
  });

  it("marks an optional field", () => {
    render(<TextField label="City" optional />);
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("is not invalid without an error", () => {
    render(<TextField label="City" />);
    expect(screen.getByLabelText("City")).not.toHaveAttribute("aria-invalid");
  });
});

describe("PasswordField", () => {
  it("toggles between hidden and visible without submitting a form", async () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label="Password" />
      </form>,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Button", () => {
  it("is disabled and busy while pending", () => {
    render(<Button isPending>Creating account…</Button>);
    const button = screen.getByRole("button", { name: "Creating account…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("defaults to type=button so it never submits by accident", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
});

describe("Alert", () => {
  it("announces errors as alerts and info as status", () => {
    render(
      <>
        <Alert tone="error">Invalid email or password.</Alert>
        <Alert tone="info">Check your inbox.</Alert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByRole("status")).toHaveTextContent("Check your inbox.");
  });
});
