import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/** Renders with a fresh React Query client that never retries, so a failure shows at once. */
export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    // A query that sets its own retry (a 404 is final, anything else is tried again) still
    // retries here, but at once instead of after a second.
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
