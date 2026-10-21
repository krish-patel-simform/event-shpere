import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { persistStore } from "redux-persist";
import { makeStore } from "./store";

/** Renders a component with its own fresh Redux store; returns the store to inspect or pre-fill. */
export function renderWithStore(ui: ReactElement, store = makeStore()) {
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

/**
 * Like renderWithStore, plus a fresh React Query client (no retries) for components that call the
 * API through hooks. Mock the feature's api service in the test; this only provides the context.
 */
export function renderWithStoreAndQuery(ui: ReactElement, store = makeStore()) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return {
    store,
    ...render(
      <Provider store={store}>
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      </Provider>,
    ),
  };
}

/** A store that has finished loading from sessionStorage, like the real one a moment after page load. */
export async function makeRehydratedStore() {
  const store = makeStore();
  const persistor = persistStore(store);
  await new Promise<void>((resolve) => {
    const check = () => persistor.getState().bootstrapped;
    if (check()) return resolve();
    const unsubscribe = persistor.subscribe(() => {
      if (check()) {
        unsubscribe();
        resolve();
      }
    });
  });
  return store;
}
