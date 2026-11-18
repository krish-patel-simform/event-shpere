"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "./base-api.service";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Retry only failures that may pass next time (network, 5xx), never a 4xx (a 429 is one)
        // and never a 503: that is the server asking for time, so an instant retry only adds load.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(
            error instanceof ApiError &&
            ((error.status >= 400 && error.status < 500) ||
              error.status === 503)
          ),
      },
      // A mutation (login, set password) must never be silently sent twice.
      mutations: { retry: false },
    },
  });
}

/** One QueryClient per browser tab (useState), so the cache survives re-renders. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
