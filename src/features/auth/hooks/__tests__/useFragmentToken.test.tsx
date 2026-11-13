/** @jest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { useFragmentToken } from "../useFragmentToken";

function openLink(url: string) {
  window.history.replaceState(null, "", url);
}

afterEach(() => openLink("/"));

describe("useFragmentToken", () => {
  it("reads the token from the fragment", () => {
    openLink("/set-password#token=abc123");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current).toEqual({ token: "abc123", ready: true });
  });

  it("decodes a token that was percent-encoded in the email link", () => {
    openLink("/set-password#token=raw-token%2Fwith%2Bchars");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current.token).toBe("raw-token/with+chars");
  });

  it("removes the token from the address bar without adding a history entry", () => {
    openLink("/set-password#token=abc123");
    const entries = window.history.length;

    renderHook(() => useFragmentToken());

    expect(window.location.href).toBe("http://localhost/set-password");
    expect(window.location.hash).toBe("");
    expect(window.history.length).toBe(entries);
  });

  it("keeps other query parameters when it cleans the address bar", () => {
    openLink("/set-password?lang=en#token=abc123");

    renderHook(() => useFragmentToken());

    expect(window.location.search).toBe("?lang=en");
    expect(window.location.hash).toBe("");
  });

  it("is ready with no token when the link has none", () => {
    openLink("/set-password");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current).toEqual({ token: null, ready: true });
  });

  it("treats an empty token (#token=) as no token", () => {
    openLink("/set-password#token=");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current).toEqual({ token: null, ready: true });
  });

  it("finds the token among other fragment parameters", () => {
    openLink("/set-password#utm=mail&token=abc123");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current.token).toBe("abc123");
  });

  it("takes the first token when the fragment repeats it", () => {
    openLink("/set-password#token=first&token=second");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current.token).toBe("first");
  });

  it("a fragment without a token is no token, and is cleaned from the address bar too", () => {
    openLink("/set-password#section");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current.token).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("does not read the token from the query string (the old link style)", () => {
    openLink("/set-password?token=old-style");

    const { result } = renderHook(() => useFragmentToken());

    expect(result.current.token).toBeNull();
  });

  it("keeps the token in Strict Mode, which runs the effect twice", () => {
    openLink("/set-password#token=abc123");
    const strict = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    const { result } = renderHook(() => useFragmentToken(), {
      wrapper: strict,
    });

    expect(result.current).toEqual({ token: "abc123", ready: true });
  });
});
