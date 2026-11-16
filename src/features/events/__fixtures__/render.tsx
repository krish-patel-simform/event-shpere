import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { VenueListItemDto } from "@/src/features/venues";
import { SAMPLE_VENUES } from "./event-manage";

/** Renders with a fresh React Query client that never retries, so a failure shows at once. */
export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    // A query that sets its own retry (the overview retries a transient error twice) still
    // retries here, but at once instead of after a second.
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

/**
 * What GET /api/venues answers for one state: the sample venues of that state, as the API's list
 * rows. The form lists exactly these, so a test changes the answer to change what is offered.
 */
export function venueListFor(state: string): {
  items: VenueListItemDto[];
  meta: { page: number; pageSize: number; total: number };
} {
  const items = SAMPLE_VENUES.filter((venue) => venue.state === state).map(
    (venue) => ({
      id: venue.id,
      name: venue.name,
      addressLine: venue.addressLine,
      city: venue.city,
      state: venue.state,
      country: "IN",
      timezone: venue.timezone,
      isActive: true,
      hallCount: venue.hallCount,
      hallsOn: venue.hallCount,
      totalSeats: venue.hallCount * 100,
    }),
  );
  return { items, meta: { page: 1, pageSize: 50, total: items.length } };
}
