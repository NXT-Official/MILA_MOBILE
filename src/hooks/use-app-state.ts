import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Runs `onForeground` when the app comes back from the background.
 *
 * This is the mobile replacement for `refetchOnWindowFocus`, which stays off in
 * the query client (§6): a phone has no window focus, and the web semantics
 * fire on events that mean nothing here.
 *
 * The callback is held in a ref so an inline arrow does not resubscribe the
 * listener on every render — a detail the React Compiler does not cover,
 * because the identity change is real, it is only the effect that must not care.
 */
export function useAppState(onForeground: () => void) {
  const callback = useRef(onForeground);

  // Written in an effect rather than during render: a ref assignment in the
  // render body is not safe under concurrent rendering, where a render can be
  // thrown away after it has already overwritten the ref.
  useEffect(() => {
    callback.current = onForeground;
  });

  useEffect(() => {
    let previous = AppState.currentState;

    const subscription = AppState.addEventListener("change", (next) => {
      // iOS passes through `inactive` on both directions. Only a genuine
      // background → active transition is a foreground, or the callback fires
      // twice per resume and each refetch is doubled.
      if (previous !== "active" && next === "active") callback.current();
      previous = next;
    });

    return () => subscription.remove();
  }, []);
}
