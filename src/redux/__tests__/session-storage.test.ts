/** @jest-environment jsdom */
import { sessionStorageAdapter } from "../session-storage";

const key = "persist:auth-flow";

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("sessionStorageAdapter when sessionStorage works", () => {
  it("stores a value and reads it back", async () => {
    await sessionStorageAdapter.setItem(key, '{"step":"otp"}');

    expect(window.sessionStorage.getItem(key)).toBe('{"step":"otp"}');
    await expect(sessionStorageAdapter.getItem(key)).resolves.toBe(
      '{"step":"otp"}',
    );
  });

  it("reads null for a key that was never stored", async () => {
    await expect(sessionStorageAdapter.getItem("missing")).resolves.toBeNull();
  });

  it("removes a stored value", async () => {
    window.sessionStorage.setItem(key, "x");

    await sessionStorageAdapter.removeItem(key);

    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
});

describe("sessionStorageAdapter when sessionStorage is blocked", () => {
  // Private mode or a browser setting: every storage call throws.
  const blocked = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };

  it("reads null instead of throwing", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);

    await expect(sessionStorageAdapter.getItem(key)).resolves.toBeNull();
  });

  it("keeps going when a value cannot be stored (for example, the quota is full)", async () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expect(
      sessionStorageAdapter.setItem(key, "value"),
    ).resolves.toBeUndefined();
  });

  it("keeps going when a value cannot be removed", async () => {
    jest.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    await expect(
      sessionStorageAdapter.removeItem(key),
    ).resolves.toBeUndefined();
  });

  it("behaves like nothing is stored when the window has no sessionStorage at all", async () => {
    jest.spyOn(window, "sessionStorage", "get").mockImplementation(blocked);

    await expect(sessionStorageAdapter.getItem(key)).resolves.toBeNull();
    await expect(
      sessionStorageAdapter.setItem(key, "value"),
    ).resolves.toBeUndefined();
    await expect(
      sessionStorageAdapter.removeItem(key),
    ).resolves.toBeUndefined();
  });
});
