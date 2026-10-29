"use client";

import { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { agentTaskSnapshotOptions } from "@multica/core/agents/queries";
import { deriveWorkloadDetail } from "@multica/core/agents/derive-presence";
import { deduplicateInboxItems, inboxListOptions } from "@multica/core/inbox/queries";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { agentListOptions } from "@multica/core/workspace/queries";
import { resolvePublicFileUrl } from "@multica/core/workspace/avatar-url";
import type { AgentTask } from "@multica/core/types";
import { ActorAvatar } from "@multica/ui/components/common/actor-avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { AppLink } from "../navigation";
import { useT } from "../i18n";

export function AgentStatusHub({ onOpenUnread }: { onOpenUnread?: (workspaceId: string, key: string) => void } = {}) {
  const workspace = useCurrentWorkspace();
  const paths = useWorkspacePaths();
  const { t } = useT("agents");
  const workspaceId = workspace?.id ?? "";
  const { data: agents } = useQuery({ ...agentListOptions(workspaceId), enabled: !!workspaceId });
  const { data: tasks } = useQuery({ ...agentTaskSnapshotOptions(workspaceId), enabled: !!workspaceId });
  const { data: inbox } = useQuery({ ...inboxListOptions(workspaceId), enabled: !!workspaceId });
  const active = useMemo(() => {
    if (!agents || !tasks) return [];
    const grouped = new Map<string, AgentTask[]>();
    for (const task of tasks) {
      const group = grouped.get(task.agent_id) ?? [];
      group.push(task);
      grouped.set(task.agent_id, group);
    }
    const unreadByAgent = new Map<string, { count: number; key: string }>();
    for (const item of deduplicateInboxItems(inbox ?? [])) {
      if (item.read || item.actor_type !== "agent" || !item.actor_id) continue;
      const previous = unreadByAgent.get(item.actor_id);
      if (previous) previous.count += 1;
      else unreadByAgent.set(item.actor_id, { count: 1, key: item.issue_id ?? item.id });
    }
    return agents.flatMap((agent) => {
      const counts = deriveWorkloadDetail(grouped.get(agent.id) ?? []);
      const unread = unreadByAgent.get(agent.id);
      return counts.workload === "idle" && !unread ? [] : [{ agent, ...counts, unread }];
    }).sort((a, b) => Number(b.runningCount > 0) - Number(a.runningCount > 0));
  }, [agents, tasks, inbox]);

  if (!workspace || active.length === 0) return null;
  return (
    <section aria-label={t(($) => $.status_hub.title)} className="border-t border-sidebar-border px-2 pt-2 pb-1">
      <style>{`@keyframes agent-hub-unread-ripple { 0% { opacity: .7; transform: scale(1); } 75%, 100% { opacity: 0; transform: scale(1.4); } }`}</style>
      <p className="px-1 text-caption text-muted-foreground">{t(($) => $.status_hub.title)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 p-1">
        {active.map(({ agent, runningCount, queuedCount, unread }) => {
          const counts = t(($) => $.status_hub.counts, { running: runningCount, queued: queuedCount });
          const unreadLabel = unread ? t(($) => $.status_hub.unread, { count: unread.count }) : null;
          const destination = unread ? t(($) => $.status_hub.open_inbox) : t(($) => $.status_hub.open_agent);
          const href = unread ? `${paths.inbox()}?${new URLSearchParams({ issue: unread.key })}` : paths.agentDetail(agent.id);
          return (
            <Tooltip key={agent.id}>
              <TooltipTrigger render={<AppLink href={href} onClick={(event) => {
                if (!unread || !onOpenUnread || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onOpenUnread(workspaceId, unread.key);
              }} aria-label={`${agent.name}: ${counts}${unreadLabel ? ` · ${unreadLabel}` : ""} · ${destination}`} className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />}>
                <span aria-hidden data-agent-workload={runningCount > 0 ? "running" : queuedCount > 0 ? "queued" : "idle"} className={runningCount > 0
                  ? "pointer-events-none absolute inset-0.5 rounded-full border-2 border-brand/30 border-t-brand border-r-brand motion-safe:animate-spin"
                  : queuedCount > 0
                    ? "pointer-events-none absolute inset-0.5 rounded-full border-[3px] border-warning shadow-[0_0_4px_var(--warning)] motion-safe:[animation:pulse_2.8s_ease-in-out_infinite]"
                    : "pointer-events-none absolute inset-0.5 rounded-full border-2 border-brand/70 motion-safe:animate-pulse motion-safe:[animation-duration:2.4s]"}>
                </span>
                <ActorAvatar name={agent.name} initials={agent.name.slice(0, 2)} avatarUrl={resolvePublicFileUrl(agent.avatar_url)} isAgent size="md" />
                {runningCount === 0 && queuedCount > 0 && <span aria-hidden className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-warning text-background ring-1 ring-background"><Hourglass className="size-2.5" /></span>}
                {unread && <span aria-hidden data-agent-unread className="pointer-events-none absolute -inset-0.5 rounded-full border border-brand/60 motion-safe:[animation:agent-hub-unread-ripple_2.4s_cubic-bezier(0.2,0.55,0.4,1)_infinite]" />}
                {unread && (runningCount > 0 || queuedCount > 0) && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-brand ring-1 ring-background" />}
              </TooltipTrigger>
              <TooltipContent side="right" className="flex-col items-start">
                <span className="font-semibold">{agent.name}</span>
                <span>{counts}</span>
                {unreadLabel && <span>{unreadLabel}</span>}
                <span>{destination}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
