/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "../use-debounced-value";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useDebouncedValue", () => {
  it("starts with the value it is given", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 300));

    expect(result.current).toBe("a");
  });

  it("changes only after the delay without a new value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => jest.advanceTimersByTime(299));
    expect(result.current).toBe("a");

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe("ab");
  });

  it("restarts the wait on every change, so typing fast sends only the last text", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "" } },
    );

    rerender({ value: "h" });
    act(() => jest.advanceTimersByTime(200));
    rerender({ value: "ha" });
    act(() => jest.advanceTimersByTime(200));
    rerender({ value: "har" });
    expect(result.current).toBe("");

    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe("har");
  });
});
