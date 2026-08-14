import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppState } from "@/hooks/use-app-state";
import { fetchHubWeather, hubById } from "@/services/weather";

/**
 * Today's weather for the member's hub.
 *
 * The key carries the hub id, so changing hubs is a different query rather than
 * an invalidation — the previous city's reading is still cached if she switches
 * back, and there is no window where the widget shows Manila's temperature
 * under London's name.
 *
 * 30 minutes stale (§6): weather does not move faster than that, and a phone
 * resumed twenty times an hour should not make twenty requests.
 */
export function useWeather(hubId: string | null | undefined) {
  const queryClient = useQueryClient();
  const hub = hubById(hubId);
  const key = ["weather", hub?.id ?? null] as const;

  const query = useQuery({
    queryKey: key,
    // No hub is not a failure — it is the blocked state, and the widget says so.
    enabled: Boolean(hub),
    staleTime: 30 * 60_000,
    queryFn: () => fetchHubWeather(hub?.id as string),
  });

  useAppState(() => {
    if (hub) void queryClient.invalidateQueries({ queryKey: ["weather", hub.id] });
  });

  return query;
}
