import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { isBuiltInIssueStatus } from "@multica/core/issue-statuses";
import type { BuiltInIssueStatus } from "@multica/core/types";
import { useCurrentWorkspace, paths } from "@multica/core/paths";
import { workspaceListOptions } from "@multica/core/workspace";
import { ListColumn, PageHeader, SharedPinnedSection, useListColumnCollapsed } from "@multica/views/layout";
import { AppLink } from "@multica/views/navigation";
import { useT } from "@multica/views/i18n";
import { LIWORK_BRIDGE_WORKSPACE_ID } from "../../../shared/liwork-monitor";

function memoryLabel(bytes: number | null): string {
  if (bytes === null) return "—";
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}
function cpuLabel(cpu: number | null): string { return cpu === null ? "—" : `${cpu.toFixed(1)}%`; }
function timeLabel(value: number | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "—";
}

export function LiworkMonitorPage() {
  const { t } = useT("settings");
  const { t: tIssues } = useT("issues");
  const currentWorkspace = useCurrentWorkspace();
  const workspaceQuery = useQuery(workspaceListOptions());
  const workspaces = workspaceQuery.data ?? [];
  const listCollapsed = useListColumnCollapsed();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["liwork-monitor"],
    queryFn: () => window.desktopAPI.getLiworkSnapshot(),
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const sessions = query.data?.sessions ?? [];
  const selected = sessions.find((item) => item.sessionId === selectedId) ?? sessions[0];
  const connected = sessions.filter((item) => item.state === "connected");
  const memoryRows = connected.filter((item) => item.memory !== null);
  const cpuRows = connected.filter((item) => item.cpu !== null);
  const sumMemory = memoryRows.reduce((sum, item) => sum + (item.memory ?? 0), 0);
  const sumCpu = cpuRows.reduce((sum, item) => sum + (item.cpu ?? 0), 0);
  const sourceWorkspace = workspaces.find((workspace) => workspace.id === LIWORK_BRIDGE_WORKSPACE_ID) ?? (currentWorkspace?.id === LIWORK_BRIDGE_WORKSPACE_ID ? currentWorkspace : null);
  const issueQuery = useQuery({
    queryKey: ["liwork-monitor-issue", sourceWorkspace?.id, selected?.issueId],
    enabled: !!sourceWorkspace && !!selected,
    queryFn: async ({ signal }) => {
      const issue = await api.getIssue(selected!.issueId, { signal, workspaceSlug: sourceWorkspace!.slug });
      if (issue.workspace_id !== LIWORK_BRIDGE_WORKSPACE_ID) throw new Error("Unexpected issue workspace");
      return issue;
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
  const projectQuery = useQuery({
    queryKey: ["liwork-monitor-project", sourceWorkspace?.id, issueQuery.data?.project_id],
    enabled: !!sourceWorkspace && !!issueQuery.data?.project_id,
    queryFn: async () => {
      const project = await api.getProject(issueQuery.data!.project_id!, sourceWorkspace!.slug);
      if (project.workspace_id !== LIWORK_BRIDGE_WORKSPACE_ID) throw new Error("Unexpected project workspace");
      return project;
    },
    retry: false,
  });
  const switchSession = useMutation({ mutationFn: (sessionId: string) => window.desktopAPI.switchLiworkSession(sessionId) });
  const task = issueQuery.data;
  const status = task ? (isBuiltInIssueStatus(task.status) ? tIssues(($) => $.status[task.status as BuiltInIssueStatus]) : task.status_name || task.status) : "—";
  const bridgeStatus = selected?.bridgeStatus === "active" ? t(($) => $.desktop.appearance.liwork_bridge_active) : selected?.bridgeStatus === "starting" ? t(($) => $.desktop.appearance.liwork_bridge_starting) : selected?.bridgeStatus === "stalled" ? t(($) => $.desktop.appearance.liwork_bridge_stalled) : "—";

  return <div data-slot="desktop-list-page" data-liwork-monitor-page className="flex min-h-0 flex-1 flex-col md:flex-row">
    <ListColumn collapsed={listCollapsed} className="max-md:h-48 max-md:w-full" innerClassName="max-md:w-full max-md:border-b max-md:border-r-0">
      <div className="flex h-12 shrink-0 items-center px-5 text-title-sm font-semibold">{t(($) => $.desktop.appearance.liwork_issues)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {sessions.map((item) => <button key={item.sessionId} type="button" onClick={() => { switchSession.reset(); setSelectedId(item.sessionId); }} aria-current={item.sessionId === selected?.sessionId ? "true" : undefined} className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-body hover:bg-surface-hover aria-[current=true]:bg-surface-selected">
          <span className="flex w-full items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${item.state === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="truncate font-medium">{item.identifier}</span><span className="ml-auto text-caption text-muted-foreground">{item.state === "connected" ? t(($) => $.desktop.appearance.liwork_connected) : t(($) => $.desktop.appearance.liwork_unconfirmed)}</span></span>
          <span className="w-full truncate text-caption text-muted-foreground">{item.title}</span>
        </button>)}
        {query.isSuccess && sessions.length === 0 && <p className="px-3 py-5 text-caption text-muted-foreground">{t(($) => $.desktop.appearance.liwork_empty)}</p>}
        <SharedPinnedSection />
      </div>
    </ListColumn>
    <div data-slot="list-page-main" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader><h1 className="min-w-0 flex-1 truncate text-body font-semibold">{t(($) => $.desktop.appearance.liwork_page)}</h1><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="rounded-md border px-3 py-1.5 text-caption hover:bg-surface-hover disabled:opacity-50">{query.isFetching ? t(($) => $.desktop.appearance.liwork_refreshing) : t(($) => $.desktop.appearance.liwork_refresh)}</button></PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto w-full max-w-[1440px]">
        {query.isError && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-body text-destructive">{t(($) => $.desktop.appearance.liwork_error)}</p>}
        {query.data && (!query.data.terminalsAvailable || !query.data.metricsAvailable) && <p role="status" className="mb-4 rounded-lg border p-3 text-body text-muted-foreground">{t(($) => $.desktop.appearance.liwork_partial)}</p>}
        {!sourceWorkspace && !workspaceQuery.isPending && <p className="mb-4 rounded-lg border p-3 text-body text-muted-foreground">{t(($) => $.desktop.appearance.liwork_other_workspace)}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Summary label={t(($) => $.desktop.appearance.liwork_sessions)} value={query.data?.terminalsAvailable ? `${connected.length} / ${sessions.length}` : "—"} />
          <Summary label={t(($) => $.desktop.appearance.liwork_cpu)} value={cpuRows.length ? cpuLabel(sumCpu) : "—"} detail={query.data && cpuRows.length ? `${cpuRows.length} / ${connected.length}` : undefined} />
          <Summary label={t(($) => $.desktop.appearance.liwork_total_memory)} value={memoryRows.length ? memoryLabel(sumMemory) : "—"} detail={query.data && memoryRows.length ? `${memoryRows.length} / ${connected.length}` : undefined} />
        </div>
        <p className="mt-3 text-caption text-muted-foreground">{t(($) => $.desktop.appearance.liwork_explanation)} {query.data && `${t(($) => $.desktop.appearance.liwork_sampled)}：${new Date(query.data.sampledAt).toLocaleTimeString()}`}</p>
        {selected ? <section className="mt-6 rounded-xl border bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1"><p className="text-caption font-medium text-muted-foreground">{selected.identifier}</p><h2 className="mt-1 break-words text-title font-semibold">{task?.title ?? selected.title}</h2></div>
            <span className="rounded-full bg-surface-selected px-3 py-1 text-caption">{selected.state === "connected" ? t(($) => $.desktop.appearance.liwork_connected) : t(($) => $.desktop.appearance.liwork_unconfirmed)}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {sourceWorkspace && <AppLink href={paths.workspace(sourceWorkspace.slug).issueDetail(selected.issueId)} className="inline-flex rounded-md bg-primary px-3 py-2 text-body text-primary-foreground hover:opacity-90">{t(($) => $.desktop.appearance.liwork_open_issue)}</AppLink>}
            {selected.state === "connected" && <button type="button" disabled={switchSession.isPending} onClick={() => switchSession.mutate(selected.sessionId)} className="rounded-md border px-3 py-2 text-body hover:bg-surface-hover disabled:opacity-50">{t(($) => $.desktop.appearance.liwork_open_session)}</button>}
          </div>
          {switchSession.isError && <p role="alert" className="mt-2 text-caption text-destructive">{t(($) => $.desktop.appearance.liwork_open_failed)}</p>}

          <DetailSection title={t(($) => $.desktop.appearance.liwork_task_info)}>
            {issueQuery.isError && <p className="col-span-full text-caption text-muted-foreground">{t(($) => $.desktop.appearance.liwork_task_error)}</p>}
            {issueQuery.isLoading && <p className="col-span-full text-caption text-muted-foreground">{t(($) => $.desktop.appearance.liwork_loading_details)}</p>}
            <Detail label={t(($) => $.desktop.appearance.liwork_task_status)} value={status} />
            <Detail label={t(($) => $.desktop.appearance.liwork_project)} value={task ? task.project_id ? projectQuery.data?.title ?? "—" : t(($) => $.desktop.appearance.liwork_no_project) : "—"} />
            <Detail label={t(($) => $.desktop.appearance.liwork_task_updated)} value={timeLabel(task?.updated_at)} />
          </DetailSection>

          <DetailSection title={t(($) => $.desktop.appearance.liwork_session_info)}>
            <Detail label={t(($) => $.desktop.appearance.liwork_bridge_status)} value={bridgeStatus} />
            <Detail label={t(($) => $.desktop.appearance.liwork_started)} value={timeLabel(selected.startedAt)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_last_output)} value={timeLabel(selected.lastOutputAt)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_agent)} value={selected.agent || "—"} />
            <Detail label={t(($) => $.desktop.appearance.liwork_worktree)} value={selected.worktreeName || "—"} />
            <p className="col-span-full text-caption text-muted-foreground">{selected.state !== "connected" ? t(($) => $.desktop.appearance.liwork_missing_terminal) : t(($) => $.desktop.appearance.liwork_output_hint)}</p>
          </DetailSection>

          <DetailSection title={t(($) => $.desktop.appearance.liwork_resources)}>
            <Detail label={t(($) => $.desktop.appearance.liwork_cpu)} value={cpuLabel(selected.cpu)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_memory)} value={memoryLabel(selected.memory)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_private_memory)} value={memoryLabel(selected.privateMemory ?? null)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_pid)} value={selected.pid == null ? "—" : String(selected.pid)} />
            <Detail label={t(($) => $.desktop.appearance.liwork_sampled)} value={timeLabel(query.data?.sampledAt)} />
            {selected.state === "connected" && selected.memory === null && <p className="col-span-full text-caption text-muted-foreground">{t(($) => $.desktop.appearance.liwork_no_metrics)}</p>}
          </DetailSection>
        </section> : <p className="mt-8 text-body text-muted-foreground">{t(($) => $.desktop.appearance.liwork_select)}</p>}
        </div>
      </div>
    </div>
  </div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6 border-t pt-5"><h3 className="text-body font-semibold">{title}</h3><div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div></section>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 break-words text-body">{value}</p></div>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border bg-surface px-4 py-4"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-1 text-title-lg font-semibold tabular-nums">{value} {detail && <span className="text-caption font-normal text-muted-foreground">({detail})</span>}</p></div>;
}
