// Keeps every window up to date with changes saved somewhere else: a job sent from the
// browser extension, an email the background queue sent, a reply it found. The backend
// counts its saves; when the count moves, the lists that show saved data refresh.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { apiGet } from "@/lib/apiClient";

const POLL_MS = 2_000;

// What can change behind the app's back. Settings, keys, profile and CVs only change from
// this window, which already refreshes them itself.
export const LIVE_QUERY_KEYS = [
  ["applications"],
  ["stats"],
  ["calendar"],
  ["notifications"],
  ["letters"],
  ["emails"],
  ["email-queue"],
  ["email-preview"],
  ["replies"],
] as const;

export function useLiveUpdates(): void {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["changes"],
    queryFn: () => apiGet<{ version: string }>("/changes"),
    refetchInterval: POLL_MS,
    // Hidden or minimised: nothing to redraw. Coming back refetches straight away.
    refetchIntervalInBackground: false,
    retry: false,
  });
  const seen = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const first = seen.current === null;
    if (seen.current === data.version) return;
    seen.current = data.version;
    if (first) return; // the screens loaded their own data just now
    for (const queryKey of LIVE_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey });
  }, [data, queryClient]);
}
