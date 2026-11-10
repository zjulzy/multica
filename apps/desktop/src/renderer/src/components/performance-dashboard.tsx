import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentTaskSnapshotOptions } from "@multica/core/agents/queries";
import { deriveWorkloadDetail } from "@multica/core/agents/derive-presence";
import { useCurrentWorkspace, useWorkspacePaths, paths } from "@multica/core/paths";
import { agentListOptions } from "@multica/core/workspace/queries";
import { workspaceListOptions } from "@multica/core/workspace";
import { PageHeader } from "@multica/views/layout";
import { AppLink } from "@multica/views/navigation";
import { useLocale } from "@multica/views/i18n";
import { LIWORK_BRIDGE_WORKSPACE_ID } from "../../../shared/liwork-monitor";
import { performanceRefreshInterval, type DesktopProcessKind } from "../../../shared/performance-monitor";

const translations = {
  zh: { title: "性能总览", subtitle: "当前采样 · 每 10 秒刷新", client: "客户端", cpu: "CPU", memory: "内存", agents: "活跃智能体", liwork: "LiWork 会话", processes: "客户端进程", running: "运行中", queued: "排队中", unavailable: "资源占用不可用", noAgents: "当前没有运行或排队的智能体", noSessions: "当前没有 LiWork 会话", unconfirmed: "待确认", connected: "已连接", unverified: "部分会话或资源数据无法确认", error: "采样暂不可用", initialCpu: "首次采样后显示 CPU", totalHint: "客户端进程工作集之和，包含缓存页面；共享内存可能被重复计入。", issue: "打开任务", process: "进程", browser: "主进程", window: "主窗口", cache: "缓存页面", shared: "窗口与缓存共享", gpu: "图形进程", other: "其他进程" },
  en: { title: "Performance", subtitle: "Current sample · refreshes every 10 seconds", client: "Client", cpu: "CPU", memory: "Memory", agents: "Active agents", liwork: "LiWork sessions", processes: "Client processes", running: "Running", queued: "Queued", unavailable: "Resource usage unavailable", noAgents: "No agents are running or queued", noSessions: "No LiWork sessions", unconfirmed: "Unconfirmed", connected: "Connected", unverified: "Some sessions or resource samples could not be verified", error: "Sample unavailable", initialCpu: "CPU available after the first interval", totalHint: "Sum of process working sets, including cached pages; shared memory may be counted more than once.", issue: "Open issue", process: "Process", browser: "Main process", window: "Main window", cache: "Cached page", shared: "Window and cache shared", gpu: "Graphics process", other: "Other process" },
} as const;
export function PerformanceDashboard() {
  const locale = useLocale();
  const s = locale.startsWith("zh") ? translations.zh : translations.en;
  const workspace = useCurrentWorkspace();
  const wsId = workspace?.id ?? "";
  const workspacePaths = useWorkspacePaths();
  const polling = { refetchInterval: 10000, refetchIntervalInBackground: false, retry: false } as const;
  const desktop = useQuery({ queryKey: ["desktop-performance-current"], queryFn: () => window.desktopAPI.getDesktopPerformanceSnapshot(), ...polling, refetchInterval: (query) => performanceRefreshInterval(query.state.data) });
  const liwork = useQuery({ queryKey: ["liwork-monitor"], queryFn: () => window.desktopAPI.getLiworkSnapshot(), ...polling });
  const agents = useQuery({ ...agentListOptions(wsId), enabled: !!wsId });
  const tasks = useQuery({ ...agentTaskSnapshotOptions(wsId), enabled: !!wsId });
  const workspaces = useQuery(workspaceListOptions());
  const sourceWorkspace = workspaces.data?.find((item) => item.id === LIWORK_BRIDGE_WORKSPACE_ID) ?? (workspace?.id === LIWORK_BRIDGE_WORKSPACE_ID ? workspace : null);
  const active = useMemo(() => (agents.data ?? []).flatMap((agent) => {
    const ownTasks = (tasks.data ?? []).filter((task) => task.agent_id === agent.id);
    const workload = deriveWorkloadDetail(ownTasks);
    return workload.workload === "idle" ? [] : [{ agent, ...workload, task: ownTasks.find((task) => task.status === "running" && task.issue_id) ?? ownTasks.find((task) => ["queued", "dispatched", "waiting_local_directory"].includes(task.status) && task.issue_id) }];
  }), [agents.data, tasks.data]);
  const sessions = liwork.data?.sessions ?? [];
  const connected = sessions.filter((item) => item.state === "connected");
  const memory = (value: number | null | undefined) => value == null ? "—" : value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : `${Math.round(value / 1024 ** 2)} MB`;
  const cpu = (value: number | null | undefined) => value == null ? "—" : `${value.toFixed(1)}%`;
  const roles: Record<DesktopProcessKind, string> = { browser: s.browser, window: s.window, cache: s.cache, shared: s.shared, gpu: s.gpu, other: s.other };
  return <div className="flex min-h-0 flex-1 flex-col bg-background">
    <PageHeader><h1 className="min-w-0 flex-1 truncate text-body font-semibold">{s.title}</h1></PageHeader>
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6"><div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div><h2 className="text-title-lg font-semibold">{s.title}</h2><p className="mt-1 text-caption text-muted-foreground">{s.subtitle}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={`${s.client} ${s.cpu}`} value={cpu(desktop.data?.totalCpu)} /><Metric label={`${s.client} ${s.memory}`} value={memory(desktop.data?.totalMemory)} />
        <Metric label={s.agents} value={tasks.isError || agents.isError || !tasks.data || !agents.data ? "—" : String(active.length)} /><Metric label={s.liwork} value={liwork.data?.terminalsAvailable ? `${connected.length} / ${sessions.length}` : "—"} />
      </div>
      <Section title={s.processes}>
        {desktop.isError ? <p className="text-muted-foreground">{s.error}</p> : <><p className="mb-3 text-caption text-muted-foreground">{s.totalHint} {desktop.data && desktop.data.totalCpu === null ? s.initialCpu : ""}</p><div className="space-y-2">{desktop.data?.processes.map((item) => <Row key={item.pid} title={`${roles[item.kind]} · ${item.pid}`} detail={`${s.cpu} ${cpu(item.cpu)}　${s.memory} ${memory(item.memory)}`} />)}</div></>}
      </Section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title={s.agents}>{agents.isError || tasks.isError ? <p className="text-muted-foreground">{s.error}</p> : active.length ? <div className="space-y-2">{active.map(({ agent, runningCount, queuedCount, task }) => <div key={agent.id} className="rounded-lg border bg-background p-3"><AppLink href={workspacePaths.agentDetail(agent.id)} className="font-medium hover:underline">{agent.name}</AppLink><p className="mt-1 text-caption text-muted-foreground">{s.running} {runningCount} · {s.queued} {queuedCount} · {s.unavailable}</p>{task?.issue_id && workspace && <AppLink className="mt-1 inline-block text-caption text-primary hover:underline" href={paths.workspace(workspace.slug).issueDetail(task.issue_id)}>{s.issue}</AppLink>}</div>)}</div> : agents.data && tasks.data ? <p className="text-muted-foreground">{s.noAgents}</p> : <p className="text-muted-foreground">…</p>}</Section>
        <Section title={s.liwork}>{liwork.isError ? <p className="text-muted-foreground">{s.error}</p> : <>{liwork.data && (!liwork.data.terminalsAvailable || !liwork.data.metricsAvailable || connected.length < sessions.length) && <p className="mb-3 text-caption text-muted-foreground">{s.unverified}</p>}{sessions.length ? <div className="space-y-2">{sessions.map((item) => <div key={item.sessionId} className="rounded-lg border bg-background p-3"><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{item.identifier || item.title}</span><span className="text-caption text-muted-foreground">{item.state === "connected" ? s.connected : s.unconfirmed}</span></div><p className="mt-1 text-caption text-muted-foreground">{s.cpu} {cpu(item.state === "connected" ? item.cpu : null)} · {s.memory} {memory(item.state === "connected" ? item.memory : null)}</p>{sourceWorkspace && <AppLink className="mt-1 inline-block text-caption text-primary hover:underline" href={paths.workspace(sourceWorkspace.slug).issueDetail(item.issueId)}>{s.issue}</AppLink>}</div>)}</div> : liwork.data ? <p className="text-muted-foreground">{s.noSessions}</p> : <p className="text-muted-foreground">…</p>}</>}</Section>
      </div>
    </div></div>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-surface p-4"><div className="text-caption text-muted-foreground">{label}</div><div className="mt-2 text-title-lg font-semibold tabular-nums">{value}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border bg-surface p-5"><h3 className="mb-4 text-body font-semibold">{title}</h3>{children}</section>; }
function Row({ title, detail }: { title: string; detail: string }) { return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-body"><span>{title}</span><span className="text-caption tabular-nums text-muted-foreground">{detail}</span></div>; }
