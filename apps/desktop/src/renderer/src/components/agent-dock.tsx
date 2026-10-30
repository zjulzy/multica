import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentTaskSnapshotOptions } from "@multica/core/agents/queries";
import { deriveWorkloadDetail } from "@multica/core/agents/derive-presence";
import { agentListOptions } from "@multica/core/workspace/queries";
import { resolvePublicFileUrl } from "@multica/core/workspace/avatar-url";
import { issueDetailOptions } from "@multica/core/issues";
import { useWorkspacePaths } from "@multica/core/paths";
import { ActorAvatar } from "@multica/ui/components/common/actor-avatar";
import { AppLink } from "@multica/views/navigation";
import { useT } from "@multica/views/i18n";
import { useTaskMessages } from "@multica/core/chat/queries";
import { buildTimeline } from "@multica/views/common/task-transcript";

export function AgentDock({ workspaceId, requestedAgent }: { workspaceId: string; requestedAgent: { agentId: string } | null }) {
  const { t } = useT("agents");
  const paths = useWorkspacePaths();
  const { data: agents = [], isLoading: loadingAgents, isError: agentsError, refetch: refetchAgents } = useQuery(agentListOptions(workspaceId));
  const { data: tasks = [], isLoading: loadingTasks, isError: tasksError, refetch: refetchTasks } = useQuery(agentTaskSnapshotOptions(workspaceId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handledRequest, setHandledRequest] = useState<typeof requestedAgent>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { if (requestedAgent && requestedAgent !== handledRequest) { setSelectedId(requestedAgent.agentId); setHandledRequest(requestedAgent); } }, [requestedAgent, handledRequest]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const active = useMemo(() => agents.flatMap((agent) => {
    const agentTasks = tasks.filter((task) => task.agent_id === agent.id);
    const counts = deriveWorkloadDetail(agentTasks);
    if (counts.workload === "idle") return [];
    const current = agentTasks.find((task) => task.status === "running") ?? agentTasks.find((task) => ["queued", "dispatched", "waiting_local_directory"].includes(task.status));
    return [{ agent, counts, current }];
  }).sort((a, b) => b.counts.runningCount - a.counts.runningCount), [agents, tasks]);
  const pendingId = requestedAgent && requestedAgent !== handledRequest ? requestedAgent.agentId : selectedId;
  const selected = active.find((item) => item.agent.id === pendingId) ?? active[0];
  const issueId = selected?.current?.issue_id || "";
  const { data: issue } = useQuery({ ...issueDetailOptions(workspaceId, issueId), enabled: !!issueId });
  const { data: messages, isError: messagesError } = useTaskMessages(selected?.current?.id ?? "", selected?.current?.status === "running", !!selected?.current?.id);
  const recent = useMemo(() => buildTimeline(messages ?? []).filter((item) => (item.type === "text" || item.type === "error") && item.content?.trim()).slice(-3), [messages]);
  const started = selected?.current?.started_at;
  const minutes = started ? Math.max(0, Math.floor((now - new Date(started).getTime()) / 60000)) : null;

  if (loadingAgents || loadingTasks) return <div className="p-5 text-muted-foreground">{t(($) => $.dock.loading)}</div>;
  if (agentsError || tasksError) return <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><p>{t(($) => $.dock.load_error)}</p><button type="button" className="text-brand hover:underline" onClick={() => { if (agentsError) void refetchAgents(); if (tasksError) void refetchTasks(); }}>{t(($) => $.dock.retry)}</button></div>;
  if (!selected) return <div className="flex h-full items-center justify-center text-muted-foreground">{t(($) => $.dock.empty)}</div>;
  return (
    <div className="flex h-full min-h-0 text-foreground">
      <div className="w-52 shrink-0 overflow-y-auto border-r p-2">
        <p className="px-2 py-1 text-caption text-muted-foreground">{t(($) => $.dock.active)}</p>
        {active.map(({ agent, counts }) => <button type="button" key={agent.id} onClick={() => setSelectedId(agent.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent ${agent.id === selected.agent.id ? "bg-accent" : ""}`}>
          <ActorAvatar name={agent.name} initials={agent.name.slice(0, 2)} avatarUrl={resolvePublicFileUrl(agent.avatar_url)} isAgent size="md" />
          <span className="min-w-0"><span className="block truncate text-label font-medium">{agent.name}</span><span className="block text-caption text-muted-foreground">{counts.runningCount ? t(($) => $.dock.running) : t(($) => $.dock.queued)}</span></span>
        </button>)}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start gap-3">
          <ActorAvatar name={selected.agent.name} initials={selected.agent.name.slice(0, 2)} avatarUrl={resolvePublicFileUrl(selected.agent.avatar_url)} isAgent size="xl" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-body font-semibold">{selected.agent.name}</h2><p className="mt-1 text-caption text-muted-foreground">{selected.counts.runningCount ? t(($) => $.dock.running) : t(($) => $.dock.queued)}{minutes !== null && Number.isFinite(minutes) ? ` · ${t(($) => $.dock.minutes, { count: minutes })}` : ""}</p></div>
          <AppLink href={paths.agentDetail(selected.agent.id)} className="text-caption text-brand hover:underline">{t(($) => $.dock.open_agent)} ↗</AppLink>
        </div>
        <div className="mt-5 rounded-md border bg-surface p-3"><p className="text-caption font-semibold text-muted-foreground">{t(($) => $.dock.current_task)}</p>
          {issueId ? <AppLink href={paths.issueDetail(issueId)} className="mt-2 block text-label text-brand hover:underline">{issue ? `${issue.identifier} ${issue.title}` : t(($) => $.dock.loading)}</AppLink> : <p className="mt-2 text-label">{selected.current?.trigger_summary || (selected.current?.chat_session_id ? t(($) => $.dock.chat_task) : t(($) => $.dock.no_issue))}</p>}
          {selected.current?.chat_session_id && <AppLink href={paths.chatSession(selected.current.chat_session_id)} className="mt-2 inline-block text-caption text-brand hover:underline">{t(($) => $.dock.open_chat)} ↗</AppLink>}
        </div>
        {selected.current?.trigger_summary && issueId && <p className="mt-3 whitespace-pre-wrap text-caption text-muted-foreground">{selected.current.trigger_summary}</p>}
        <div className="mt-4"><p className="text-caption font-semibold text-muted-foreground">{t(($) => $.dock.recent)}</p>
          {recent.length ? recent.map((item) => <p key={item.seq} className="mt-2 line-clamp-3 whitespace-pre-wrap text-caption">{item.content}</p>) : <p className="mt-2 text-caption text-muted-foreground">{messagesError ? t(($) => $.dock.progress_error) : t(($) => $.dock.no_progress)}</p>}
        </div>
      </div>
    </div>
  );
}
