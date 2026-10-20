/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithStore } from "@/src/redux/test-utils";
import { selectPendingVerification } from "../store/auth-flow.slice";
import { OrganizerSignupForm } from "../components/forms/OrganizerSignupForm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockReset());

async function fillRequired(overrides: { confirm?: string } = {}) {
  await userEvent.type(screen.getByLabelText("First name"), "Ananya");
  await userEvent.type(screen.getByLabelText("Last name"), "Rao");
  await userEvent.type(screen.getByLabelText("Work email"), "ananya@acme.com");
  await userEvent.type(screen.getByLabelText("Organisation name"), "Acme Events");
  await userEvent.type(screen.getByLabelText("Password", { selector: "input" }), "Secret123!");
  await userEvent.type(screen.getByLabelText("Confirm password"), overrides.confirm ?? "Secret123!");
}

describe("OrganizerSignupForm", () => {
  it("groups the fields under the three headings from the design", () => {
    renderWithStore(<OrganizerSignupForm />);
    for (const name of ["About you", "Your organisation", "Password"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
  });

  it("shows required-field errors on submit", async () => {
    renderWithStore(<OrganizerSignupForm />);
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Organization name is required")).toBeInTheDocument();
  });

  it("accepts a valid form with the website left empty", async () => {
    renderWithStore(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));

    // An empty optional website must count as "not provided", not as an invalid URL.
    expect(screen.queryByText(/Use a full http/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects a website that is not an http(s) URL", async () => {
    renderWithStore(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/Website/), "javascript:alert(1)");
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText(/Use a full http/)).toBeInTheDocument();
  });

  it("shows 'Passwords do not match' under the confirm field", async () => {
    renderWithStore(<OrganizerSignupForm />);
    await fillRequired({ confirm: "Different1!" });
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
  });

  it("hands over to check-email and remembers the address", async () => {
    const { store } = renderWithStore(<OrganizerSignupForm />);
    await fillRequired();
    await userEvent.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/check-email"));
    expect(selectPendingVerification(store.getState())?.email).toBe("ananya@acme.com");
  });
});
