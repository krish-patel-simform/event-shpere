"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `intervalMs`. For screens that stay open for hours and must
 * notice a time passing (a check-in door opening or closing), without reloading anything.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
