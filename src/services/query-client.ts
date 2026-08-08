import { QueryClient } from "@tanstack/react-query";

import { ApiError, NON_RETRYABLE_CODES } from "./api/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: (count, error) => {
        if (error instanceof ApiError && NON_RETRYABLE_CODES.includes(error.code as never)) {
          return false;
        }
        return count < 2;
      },
      // Web semantics do not apply on a phone; use useAppState instead.
      refetchOnWindowFocus: false,
    },
    // Never auto-retry a credit-charging call — a retry is a double charge.
    mutations: { retry: false },
  },
});
