"use client";

import { useSyncExternalStore } from "react";
import { readThemePreference, subscribeThemePreference, type ThemePreference } from "./theme";

/** The current choice, kept in sync across switches and tabs. "system" on the server. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribeThemePreference, readThemePreference, () => "system");
}
