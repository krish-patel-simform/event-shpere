// Pure browser/DOM logic, no React: the root layout (a Server Component) imports THEME_INIT_SCRIPT
// from here. The React hook is in use-theme-preference.ts, which is a Client Component file.

/** `system` follows the operating system; light and dark are the user's explicit choice. */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
const THEME_CHANGED_EVENT = "eventsphere:theme-changed";

/**
 * Runs in <head> before the first paint (see app/layout.tsx), so the saved theme is applied
 * before anything is drawn and there is no flash of the wrong theme. Plain ES5 on purpose.
 * With no saved choice it does nothing and the CSS follows the system setting.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/** The saved choice. Anything unknown, or storage being unavailable, means "system". */
export function readThemePreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/** Saves the choice and applies it at once. `system` removes both and hands control to the OS. */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);

  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked (private mode): the choice still applies until the page is closed.
  }
  // Other theme switches on the same page (the `storage` event only reaches other tabs).
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

/** Calls `onChange` when the choice changes on this page (any switch) or in another tab. */
export function subscribeThemePreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGED_EVENT, onChange);
  };
}
