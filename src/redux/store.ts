import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer } from "redux-persist";
import { authFlowReducer } from "@/src/features/auth";
import { sessionStorageAdapter } from "./session-storage";

const rootReducer = combineReducers({
  // Only this slice is persisted (per browser tab, sessionStorage).
  authFlow: persistReducer({ key: "authFlow", storage: sessionStorageAdapter }, authFlowReducer),
});

/**
 * One store per request on the server and per browser tab on the client: never a module-level
 * singleton, which would leak state between users during server rendering.
 * <StoreProvider> calls this once.
 */
export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // redux-persist's own actions carry functions; they are not app state.
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

/**
 * True once the persisted state has been read from sessionStorage. `_persist` does not exist at
 * all until persistStore() has run, which is never on the server and not yet on the first
 * browser render, so a missing `_persist` means "not loaded yet".
 */
export const selectAuthFlowRehydrated = (state: RootState): boolean =>
  state.authFlow._persist?.rehydrated ?? false;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
