// ViewModel: backup download and restore (staged; applied when CareerPilot restarts).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiGet, apiPostForm, apiSend, errorText } from "@/lib/apiClient";

interface RestoreStatus {
  pending: { created_at?: string } | null;
}

export interface BackupViewModel {
  pending: RestoreStatus["pending"];
  isRestoring: boolean;
  restore: (file: File) => void;
  cancel: () => void;
}

export function useBackupViewModel(): BackupViewModel {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["restore"],
    queryFn: () => apiGet<RestoreStatus>("/restore"),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["restore"] });
  const restore = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiPostForm<{ message: string }>("/restore", form);
    },
    onSuccess: (result) => {
      refresh();
      toast.success(result.message, { duration: 10_000 });
    },
    onError: (e) => toast.error(errorText(e), { duration: 10_000 }),
  });
  const cancel = useMutation({
    mutationFn: () => apiSend<null>("DELETE", "/restore"),
    onSuccess: () => {
      refresh();
      toast.success("Restore cancelled. Nothing was changed.");
    },
  });
  return {
    pending: status.data?.pending ?? null,
    isRestoring: restore.isPending,
    restore: (file) => restore.mutate(file),
    cancel: () => cancel.mutate(),
  };
}
