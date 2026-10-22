/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import {
  selectPendingVerification,
  verificationStarted,
} from "@/src/redux/slices/auth-flow.slice";
import { makeStore } from "@/src/redux/store";
import {
  makeRehydratedStore,
  renderWithStoreAndQuery,
} from "@/src/redux/test-utils";
import { authApiService } from "../../../api/auth-api.service";
import { CheckEmailPanel } from "../../states/CheckEmailPanel";
import { CheckEmailScreen } from "../CheckEmailScreen";

jest.mock("../../../api/auth-api.service", () => ({
  authApiService: { resendOtp: jest.fn() },
}));
const resendOtp = jest.mocked(authApiService.resendOtp);

const sent = {
  email: "ananya@example.com",
  verificationEmailSent: true,
  expiresInMinutes: 5,
};

beforeEach(() => {
  window.sessionStorage.clear();
  resendOtp.mockReset();
  resendOtp.mockResolvedValue(undefined);
});

const resendButton = () =>
  screen.getByRole("button", { name: /Resend code|Sending/ });

describe("CheckEmailPanel", () => {
  it("says where the code went and how long it works", () => {
    renderWithStoreAndQuery(
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
    renderWithStoreAndQuery(
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

  it("'Start again' tells the parent to forget the signup and links to signup", async () => {
    const onStartAgain = jest.fn();
    renderWithStoreAndQuery(
      <CheckEmailPanel pending={sent} onStartAgain={onStartAgain} />,
    );

    const link = screen.getByRole("link", { name: "Start again" });
    expect(link).toHaveAttribute("href", "/signup");
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);
    expect(onStartAgain).toHaveBeenCalled();
  });

  describe("Resend code", () => {
    function renderPanel(pending = sent) {
      renderWithStoreAndQuery(
        <CheckEmailPanel pending={pending} onStartAgain={jest.fn()} />,
      );
    }

    it("does not call the API until it is clicked", () => {
      renderPanel();

      expect(resendButton()).toBeEnabled();
      expect(resendOtp).not.toHaveBeenCalled();
    });

    it("sends the stored email and says a new code was sent, without claiming it was delivered", async () => {
      renderPanel();
      await userEvent.click(resendButton());

      const status = await screen.findByRole("status");
      expect(resendOtp).toHaveBeenCalledTimes(1);
      expect(resendOtp.mock.calls[0][0]).toEqual({
        email: "ananya@example.com",
      });
      expect(status).toHaveTextContent("If your signup is still waiting");
      expect(status).toHaveTextContent("ananya@example.com");
      expect(status).toHaveTextContent("Only the newest email works");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("disables the button while the request is pending", async () => {
      resendOtp.mockReturnValue(new Promise(() => {}));
      renderPanel();
      await userEvent.click(resendButton());

      const button = await screen.findByRole("button", { name: /Sending/ });
      expect(button).toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("a rate-limited request shows the server's message in the alert and no success message", async () => {
      resendOtp.mockRejectedValue(
        new ApiError(
          429,
          "RATE_LIMITED",
          "Too many requests. Try again later.",
        ),
      );
      renderPanel();
      await userEvent.click(resendButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Too many requests. Try again later.");
      expect(alert).toHaveFocus();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("a network failure shows a retryable alert, and 'Try again' sends the request again", async () => {
      resendOtp.mockRejectedValueOnce(
        new ApiError(0, "NETWORK_ERROR", "Could not reach the server."),
      );
      renderPanel();
      await userEvent.click(resendButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong",
      );

      await userEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "If your signup is still waiting",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(resendOtp).toHaveBeenCalledTimes(2);
    });
  });
});

describe("CheckEmailScreen", () => {
  it("shows a loading placeholder until the store has read sessionStorage", () => {
    renderWithStoreAndQuery(<CheckEmailScreen />, makeStore()); // never rehydrated
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Check your email" }),
    ).not.toBeInTheDocument();
  });

  it("shows the signup that is waiting, with the expiry in the progress card", async () => {
    const store = await makeRehydratedStore();
    store.dispatch(verificationStarted(sent));
    renderWithStoreAndQuery(<CheckEmailScreen />, store);

    expect(
      screen.getByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/code expires in 5 minutes/)).toBeInTheDocument();
  });

  it("'Resend code' on the screen sends the stored email", async () => {
    const store = await makeRehydratedStore();
    store.dispatch(verificationStarted(sent));
    renderWithStoreAndQuery(<CheckEmailScreen />, store);

    await userEvent.click(resendButton());

    expect(await screen.findByRole("status", { name: "" })).toBeInTheDocument();
    expect(resendOtp.mock.calls[0][0]).toEqual({ email: "ananya@example.com" });
  });

  it("with no signup in progress: says so and offers log in / sign up", async () => {
    const store = await makeRehydratedStore();
    renderWithStoreAndQuery(<CheckEmailScreen />, store);

    expect(
      screen.getByRole("heading", { name: "No signup to verify" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.queryByRole("button", { name: /Resend code/ }),
    ).not.toBeInTheDocument();
  });

  it("'Start again' clears the stored signup", async () => {
    const store = await makeRehydratedStore();
    store.dispatch(verificationStarted(sent));
    renderWithStoreAndQuery(<CheckEmailScreen />, store);

    const link = screen.getByRole("link", { name: "Start again" });
    link.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);

    expect(selectPendingVerification(store.getState())).toBeNull();
  });
});
