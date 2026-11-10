import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useAuthStore } from "@multica/core/auth";
import { useCurrentWorkspace } from "@multica/core/paths";
import { createMeegoSyncApi } from "./meego-sync-api";

export function useMeegoSync(enabled = true, poll = false) {
  const workspace = useCurrentWorkspace();
  const user = useAuthStore((state) => state.user);
  const baseUrl = api.getBaseUrl();
  const service = useMemo(() => createMeegoSyncApi(baseUrl, () => api.getToken(), () => api.getBaseUrl()), [baseUrl]);
  const key = ["meego-sync", baseUrl, user?.id ?? "", workspace?.id ?? ""] as const;
  const query = useQuery({ queryKey: key, queryFn: service.status, enabled: enabled && !!workspace?.id && !!user?.id, retry: false, staleTime: 20000, refetchInterval: poll ? (q) => q.state.data?.running ? 3000 : 20000 : false, refetchIntervalInBackground: false });
  return { workspace, service, query, key, matches: !!workspace && query.data?.workspace === workspace.slug };
}
