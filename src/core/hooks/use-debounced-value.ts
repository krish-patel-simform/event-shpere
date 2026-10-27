"use client";

import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delayMs`. For a search box: the input
 * updates at once (`search`), while the API is asked only for the settled text (`debounced`).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
