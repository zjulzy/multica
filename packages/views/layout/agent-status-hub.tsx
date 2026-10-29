"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { agentTaskSnapshotOptions } from "@multica/core/agents/queries";
import { deriveWorkloadDetail } from "@multica/core/agents/derive-presence";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { agentListOptions } from "@multica/core/workspace/queries";
import { resolvePublicFileUrl } from "@multica/core/workspace/avatar-url";
import type { AgentTask } from "@multica/core/types";
import { ActorAvatar } from "@multica/ui/components/common/actor-avatar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { AppLink } from "../navigation";
import { useT } from "../i18n";

export function AgentStatusHub() {
  const workspace = useCurrentWorkspace();
  const paths = useWorkspacePaths();
  const { t } = useT("agents");
  const workspaceId = workspace?.id ?? "";
  const { data: agents } = useQuery({ ...agentListOptions(workspaceId), enabled: !!workspaceId });
  const { data: tasks } = useQuery({ ...agentTaskSnapshotOptions(workspaceId), enabled: !!workspaceId });
  const active = useMemo(() => {
    if (!agents || !tasks) return [];
    const grouped = new Map<string, AgentTask[]>();
    for (const task of tasks) {
      const group = grouped.get(task.agent_id) ?? [];
      group.push(task);
      grouped.set(task.agent_id, group);
    }
    return agents.flatMap((agent) => {
      const counts = deriveWorkloadDetail(grouped.get(agent.id) ?? []);
      return counts.workload === "idle" ? [] : [{ agent, ...counts }];
    }).sort((a, b) => Number(b.runningCount > 0) - Number(a.runningCount > 0));
  }, [agents, tasks]);

  if (!workspace || active.length === 0) return null;

  return (
    <section aria-label={t(($) => $.status_hub.title)} className="border-t border-sidebar-border px-2 pt-2 pb-1">
      <p className="px-1 text-caption text-muted-foreground">{t(($) => $.status_hub.title)}</p>
      <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto p-1">
        {active.map(({ agent, runningCount, queuedCount }) => {
          const counts = t(($) => $.status_hub.counts, { running: runningCount, queued: queuedCount });
          return (
            <Tooltip key={agent.id}>
              <TooltipTrigger render={<AppLink href={paths.agentDetail(agent.id)} aria-label={`${agent.name}: ${counts}`} className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />}>
                <span aria-hidden className={runningCount > 0
                  ? "pointer-events-none absolute inset-0 rounded-full border-2 border-brand/30 border-t-brand border-r-brand motion-safe:animate-spin"
                  : "pointer-events-none absolute inset-0 rounded-full border-2 border-warning"} />
                <ActorAvatar name={agent.name} initials={agent.name.slice(0, 2)} avatarUrl={resolvePublicFileUrl(agent.avatar_url)} isAgent size="md" />
              </TooltipTrigger>
              <TooltipContent side="right" className="flex-col items-start">
                <span className="font-semibold">{agent.name}</span>
                <span>{counts}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
