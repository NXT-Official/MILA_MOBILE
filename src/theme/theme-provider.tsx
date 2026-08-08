import type { ReactNode } from "react";

import { useAppliedTheme } from "./theme";

/**
 * Owns nothing but the side effect. Kept as a component rather than a hook call
 * in the layout so the layout body does not re-render on every scheme change.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useAppliedTheme();
  return <>{children}</>;
}
