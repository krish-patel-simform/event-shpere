/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../base-api.service";
import { QueryProvider } from "../QueryProvider";

function Probe({ queryFn }: { queryFn: () => Promise<never> }) {
  const { isError, failureCount } = useQuery({
    queryKey: ["probe"],
    queryFn,
    // The default delay (1s, 2s) would make a retrying run slow; the rule under test is whether
    // a retry happens at all.
    retryDelay: 1,
  });
  return <p>{isError ? `failed after ${failureCount}` : "loading"}</p>;
}

function run(error: unknown) {
  const queryFn = jest.fn().mockRejectedValue(error);
  render(
    <QueryProvider>
      <Probe queryFn={queryFn} />
    </QueryProvider>,
  );
  return queryFn;
}

describe("QueryProvider retry rule", () => {
  it.each([
    ["a 503 (the server asked for time)", new ApiError(503, "UNKNOWN", "Busy")],
    ["a 429 (rate limited)", new ApiError(429, "RATE_LIMITED", "Slow down")],
    ["a 404", new ApiError(404, "NOT_FOUND", "Missing")],
  ])("does not retry %s", async (_name, error) => {
    const queryFn = run(error);

    await screen.findByText("failed after 1");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("retries a failure that may pass next time, twice at most (a 500)", async () => {
    const queryFn = run(new ApiError(500, "UNKNOWN", "Boom"));

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3));
    await screen.findByText("failed after 3");
  });

  it("retries a network failure", async () => {
    const queryFn = run(new ApiError(0, "NETWORK_ERROR", "Offline"));

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(3));
  });
});
