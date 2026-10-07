import { usePathname } from "expo-router";
import { useEffect } from "react";

import { trackScreen } from "@/services/observability";

/**
 * Reports a screen view whenever the router pathname changes, through the
 * observability facade (PostHog + a sanitized Sentry breadcrumb). One effect on
 * the pathname covers every push and tab switch.
 */
export function useScreenViews(): void {
  const pathname = usePathname();
  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);
}
