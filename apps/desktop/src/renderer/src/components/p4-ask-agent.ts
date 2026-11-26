import { isAgentRuntimeBound } from "@multica/core/agents";
import { canAssignAgentToIssue } from "@multica/core/permissions";
import type { Agent, AgentTask, Issue, MemberRole } from "@multica/core/types";
import { escapeMarkdownLabel } from "../../../../../../packages/views/editor/utils/escape-markdown-label";

export function chooseP4AskAgent(issue: Issue, tasks: readonly AgentTask[], agents: readonly Agent[], userId: string | null, role: MemberRole | null): Agent | null {
  const usable = agents.filter((agent) => !agent.archived_at && isAgentRuntimeBound(agent) && canAssignAgentToIssue(agent, { userId, role }).allowed);
  if (issue.assignee_type === "agent" && issue.assignee_id) {
    const assignee = usable.find((agent) => agent.id === issue.assignee_id);
    if (assignee) return assignee;
  }
  const recent = tasks.filter((task) => task.issue_id === issue.id && Number.isFinite(Date.parse(task.created_at)))
    .slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  for (const task of recent) {
    const agent = usable.find((candidate) => candidate.id === task.agent_id);
    if (agent) return agent;
  }
  return null;
}

export function formatP4AskMention(agent: Agent): string {
  return `[@${escapeMarkdownLabel(agent.name)}](mention://agent/${agent.id})`;
}
