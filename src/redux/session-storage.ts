import type { Storage } from "redux-persist";

/**
 * sessionStorage for redux-persist. Not `redux-persist/lib/storage/session`: that one builds
 * its storage when the module loads and logs an error on the server. This one only touches
 * `window` when a method runs, which happens in the browser only.
 * Failures (private mode, blocked storage) behave like "nothing stored".
 */
export const sessionStorageAdapter: Storage = {
  async getItem(key: string) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Not persisted; the app keeps working with in-memory state.
    }
  },
  async removeItem(key: string) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};
