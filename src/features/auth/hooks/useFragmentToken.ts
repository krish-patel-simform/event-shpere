"use client";

import { useEffect, useRef, useState } from "react";

type FragmentToken = {
  /** The one-time token from the link, or null when the link has none. */
  token: string | null;
  /** False until the browser has been asked: the server cannot see the fragment. */
  ready: boolean;
};

/**
 * Reads the one-time token of an emailed link (/page#token=...) and removes it from the
 * address bar. The fragment is never sent to the server, so the token stays out of access
 * logs and the Referer header. The token is kept in state and goes to the API in the request
 * body, like any other field.
 */
export function useFragmentToken(): FragmentToken {
  const [state, setState] = useState<FragmentToken>({
    token: null,
    ready: false,
  });
  // React Strict Mode runs this effect twice in development; the second run finds the
  // fragment already removed. The ref keeps what the first run read.
  const found = useRef<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    if (fromUrl) found.current = fromUrl;

    // Replace the current history entry, so the token is gone from the address bar and from
    // the back button. No reload and no new entry.
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setState({ token: found.current, ready: true });
  }, []);

  return state;
}
