import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and while React hydrates the server HTML, true afterwards in the browser.
 * Use it before rendering anything that only the browser knows (sessionStorage, persisted
 * Redux state), so the first client render matches the server HTML and hydration does not fail.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true, // client value
    () => false, // server value, also used during hydration
  );
}
