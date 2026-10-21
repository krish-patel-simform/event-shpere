/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "@/src/redux/test-utils";
import { selectPendingVerification } from "@/src/redux/slices/auth-flow.slice";
import { UserSignupForm } from "../components/forms/UserSignupForm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockReset());

async function fillRequired(overrides: { password?: string; confirm?: string } = {}) {
  await userEvent.type(screen.getByLabelText("First name"), "Ananya");
  await userEvent.type(screen.getByLabelText("Last name"), "Rao");
  await userEvent.type(screen.getByLabelText("Email address"), "ananya@example.com");
  await userEvent.type(screen.getByLabelText("Password"), overrides.password ?? "Secret123!");
  await userEvent.type(screen.getByLabelText("Confirm password"), overrides.confirm ?? "Secret123!");
}

describe("UserSignupForm", () => {
  it("shows required-field errors on submit", async () => {
    renderWithStore(<UserSignupForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
  });

  it("accepts a valid form with every optional field left empty", async () => {
    renderWithStore(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    // Empty optional boxes must count as "not provided", not as an invalid phone/URL.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/valid phone number/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Use a full http/)).not.toBeInTheDocument();
  });

  it("rejects a badly formatted phone number and photo URL when they are filled in", async () => {
    renderWithStore(<UserSignupForm />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Phone/), "12");
    await userEvent.type(screen.getByLabelText(/Profile photo URL/), "ftp://x");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(/valid phone number/)).toBeInTheDocument();
    expect(screen.getByText(/Use a full http/)).toBeInTheDocument();
  });

  it("shows 'Passwords do not match' under the confirm field", async () => {
    renderWithStore(<UserSignupForm />);
    await fillRequired({ confirm: "Different1!" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("updates the password checklist while typing", async () => {
    renderWithStore(<UserSignupForm />);
    const list = screen.getByRole("list", { name: "Password requirements" });
    expect(list).toHaveTextContent("A number (not met)");

    await userEvent.type(screen.getByLabelText("Password"), "abc1");
    expect(list).toHaveTextContent("A number (met)");
    expect(list).toHaveTextContent("A lowercase letter (met)");
    expect(list).toHaveTextContent("An uppercase letter (not met)");
  });

  it("hands over to check-email and remembers the address", async () => {
    const { store } = renderWithStore(<UserSignupForm />);
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(selectPendingVerification(store.getState())).toMatchObject({
      email: "ananya@example.com",
      verificationEmailSent: true,
    });
  });

  it("does not leave the page when the form is invalid", async () => {
    renderWithStore(<UserSignupForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await screen.findByText("First name is required");
    expect(mockPush).not.toHaveBeenCalled();
  });
});
