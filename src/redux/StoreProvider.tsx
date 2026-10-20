"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { persistStore } from "redux-persist";
import { makeStore } from "./store";

/** One store per browser tab (useState), restored from sessionStorage once the page is mounted. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  // Rehydrating needs the browser, so it runs in an effect, never during server rendering.
  // React Strict Mode runs this twice in development: persistStore is safe to call again.
  useEffect(() => {
    const persistor = persistStore(store);
    return () => persistor.pause();
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
