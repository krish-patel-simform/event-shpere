import {
  authFlowReducer,
  selectPendingVerification,
  verificationCleared,
  verificationStarted,
} from "../store/auth-flow.slice";

const pending = { email: "ananya@example.com", verificationEmailSent: true, expiresInMinutes: 5 };

describe("authFlow slice", () => {
  it("starts with nothing pending", () => {
    const state = authFlowReducer(undefined, { type: "@@init" });
    expect(selectPendingVerification({ authFlow: state })).toBeNull();
  });

  it("stores the signup result when verification starts", () => {
    const state = authFlowReducer(undefined, verificationStarted(pending));
    expect(selectPendingVerification({ authFlow: state })).toEqual(pending);
  });

  it("forgets it once cleared", () => {
    const started = authFlowReducer(undefined, verificationStarted(pending));
    const cleared = authFlowReducer(started, verificationCleared());
    expect(selectPendingVerification({ authFlow: cleared })).toBeNull();
  });
});
