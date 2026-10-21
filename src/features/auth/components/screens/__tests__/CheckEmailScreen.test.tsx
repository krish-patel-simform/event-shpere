/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeRehydratedStore, renderWithStore } from "@/src/redux/test-utils";
import { makeStore } from "@/src/redux/store";
import { CheckEmailPanel } from "../../states/CheckEmailPanel";
import { CheckEmailScreen } from "../CheckEmailScreen";
import {
  selectPendingVerification,
  verificationStarted,
} from "@/src/redux/slices/auth-flow.slice";

const sent = {
  email: "ananya@example.com",
  verificationEmailSent: true,
  expiresInMinutes: 5,
};

beforeEach(() => window.sessionStorage.clear());

describe("CheckEmailPanel", () => {
  it("says where the code went and how long it works", () => {
    renderWithStore(
      <CheckEmailPanel pending={sent} onStartAgain={jest.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ananya@example.com")).toBeInTheDocument();
    expect(screen.getByText("5 minutes")).toBeInTheDocument();
    expect(screen.getByText("Enter the 6-digit code")).toBeInTheDocument();
  });

  it("when the email could not be sent: warns, and drops the 'we sent' text and steps", () => {
    renderWithStore(
      <CheckEmailPanel
        pending={{ ...sent, verificationEmailSent: false }}
        onStartAgain={jest.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't send the verification email",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("ananya@example.com");
    expect(
      screen.queryByText(/We sent a 6-digit code/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Enter the 6-digit code"),
    ).not.toBeInTheDocument();
  });

  it("shows resend as disabled (not built yet)", () => {
    renderWithStore(
      <CheckEmailPanel pending={sent} onStartAgain={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Resend code/ })).toBeDisabled();
  });

  it("'Start again' tells the parent to forget the signup and links to signup", async () => {
    const onStartAgain = jest.fn();
    renderWithStore(
      <CheckEmailPanel pending={sent} onStartAgain={onStartAgain} />,
    );

    const link = screen.getByRole("link", { name: "Start again" });
    expect(link).toHaveAttribute("href", "/signup");
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);
    expect(onStartAgain).toHaveBeenCalled();
  });
});

describe("CheckEmailScreen", () => {
  it("shows a loading placeholder until the store has read sessionStorage", () => {
    renderWithStore(<CheckEmailScreen />, makeStore()); // never rehydrated
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).not.toBeInTheDocument();
  });

  it("shows the signup that is waiting, with the expiry in the progress card", async () => {
    const store = await makeRehydratedStore();
    store.dispatch(verificationStarted(sent));
    renderWithStore(<CheckEmailScreen />, store);

    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/code expires in 5 minutes/)).toBeInTheDocument();
  });

  it("with no signup in progress: says so and offers log in / sign up", async () => {
    const store = await makeRehydratedStore();
    renderWithStore(<CheckEmailScreen />, store);

    expect(
      screen.getByRole("heading", { name: "No signup to verify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/signup");
  });

  it("'Start again' clears the stored signup", async () => {
    const store = await makeRehydratedStore();
    store.dispatch(verificationStarted(sent));
    renderWithStore(<CheckEmailScreen />, store);

    const link = screen.getByRole("link", { name: "Start again" });
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);

    expect(selectPendingVerification(store.getState())).toBeNull();
  });
});
