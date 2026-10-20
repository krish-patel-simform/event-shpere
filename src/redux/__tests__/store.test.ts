/** @jest-environment jsdom */
import { persistStore } from "redux-persist";
import { selectPendingVerification, verificationCleared, verificationStarted } from "@/src/features/auth";
import { makeStore } from "../store";

const pending = { email: "ananya@example.com", verificationEmailSent: true, expiresInMinutes: 5 };

async function rehydrated(store: ReturnType<typeof makeStore>) {
  const persistor = persistStore(store);
  await new Promise<void>((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
  return persistor;
}

beforeEach(() => window.sessionStorage.clear());

describe("store persistence (sessionStorage)", () => {
  it("restores the pending verification in a new store, as after a page refresh", async () => {
    const first = makeStore();
    const persistor = await rehydrated(first);
    first.dispatch(verificationStarted(pending));
    await persistor.flush();

    const afterRefresh = makeStore();
    await rehydrated(afterRefresh);

    expect(selectPendingVerification(afterRefresh.getState())).toEqual(pending);
  });

  it("does not bring it back after it was cleared", async () => {
    const first = makeStore();
    const persistor = await rehydrated(first);
    first.dispatch(verificationStarted(pending));
    first.dispatch(verificationCleared());
    await persistor.flush();

    const afterRefresh = makeStore();
    await rehydrated(afterRefresh);

    expect(selectPendingVerification(afterRefresh.getState())).toBeNull();
  });

  it("gives every makeStore() call its own state", () => {
    const a = makeStore();
    const b = makeStore();
    a.dispatch(verificationStarted(pending));
    expect(selectPendingVerification(b.getState())).toBeNull();
  });
});
