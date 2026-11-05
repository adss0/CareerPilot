// ViewModel: turns Model data into exactly what the View needs (state + actions).
import { useQuery } from "@tanstack/react-query";

import { fetchHealth } from "./api";
import type { BackendStatus } from "./types";

export interface HealthViewModel {
  status: BackendStatus;
  version?: string;
  aiProvider?: string;
  isRefreshing: boolean;
  refresh: () => void;
}

export function useHealthViewModel(): HealthViewModel {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    retry: false,
  });

  let status: BackendStatus = "checking";
  if (query.isSuccess && query.data.status === "ok") status = "online";
  else if (query.isError) status = "offline";

  return {
    status,
    version: query.data?.version,
    aiProvider: query.data?.ai_provider,
    isRefreshing: query.isFetching,
    refresh: () => void query.refetch(),
  };
}
