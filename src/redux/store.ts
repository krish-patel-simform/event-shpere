import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

const store = configureStore({
  reducer: {},
});

export default store;
type RootStore = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useAppSelector = useSelector.withTypes<RootStore>();
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
