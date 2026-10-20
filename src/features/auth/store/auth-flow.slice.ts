import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * What the "Check your email" screen needs after a signup. It lives in the store (and is
 * persisted to sessionStorage, see src/redux/store.ts) so that the email address is not put
 * in the URL, and a page refresh does not lose it. Cleared once the email is verified.
 */
export type PendingVerification = {
  email: string;
  /** False when the account was created but the code could not be sent. */
  verificationEmailSent: boolean;
  expiresInMinutes: number;
};

export type AuthFlowState = { pendingVerification: PendingVerification | null };

const initialState: AuthFlowState = { pendingVerification: null };

const authFlowSlice = createSlice({
  name: "authFlow",
  initialState,
  reducers: {
    verificationStarted(state, action: PayloadAction<PendingVerification>) {
      state.pendingVerification = action.payload;
    },
    verificationCleared(state) {
      state.pendingVerification = null;
    },
  },
});

export const { verificationStarted, verificationCleared } = authFlowSlice.actions;
export const authFlowReducer = authFlowSlice.reducer;

// Typed on the slice's own shape (not the root state), so the feature never imports the store.
export const selectPendingVerification = (state: { authFlow: AuthFlowState }) =>
  state.authFlow.pendingVerification;
