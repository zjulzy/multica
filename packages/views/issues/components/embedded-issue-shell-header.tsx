import { useQuery } from "@tanstack/react-query";
import { issueBehavesAsAny } from "@multica/core/issues";
import { issueDetailOptions } from "@multica/core/issues/queries";
import { projectDetailOptions } from "@multica/core/projects/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspacePaths } from "@multica/core/paths";
import { ActorDirectoryBoundary } from "@multica/core/workspace/actor-directory";
import type { Issue } from "@multica/core/types";
import { MoreHorizontal, PanelRight, Pin, PinOff, ChevronRight } from "@multica/ui/icons";
import { IconButton } from "@multica/ui/components/common/icon-button";
import { cn } from "@multica/ui/lib/utils";
import { useT } from "../../i18n";
import { AppLink } from "../../navigation";
import { ProjectIcon } from "../../projects/components/project-icon";
import { useShowInSidebar } from "../../layout/panels/show-in-sidebar";
import { ActionShortcutKeycaps } from "../../common/shortcut-keycaps";
import { IssueActionsDropdown, IssueInboxActions, useArchivedInboxItemId, useIssueActions } from "../actions";
import { IssueAgentHeaderChip } from "./issue-agent-header-chip";
import { IssueWakeupHeaderChip } from "./issue-wakeup-header-chip";

export type EmbeddedIssueHeaderAction = { command: "toggle-sidebar" | "open-wakeups" } | { command: "jump-to-run"; taskId: string };

/** Interactive counterpart of the cached issue's header in the desktop shell. */
export function EmbeddedIssueShellHeader({ issue, sidebarOpen, onCommand }: { issue: Issue; sidebarOpen: boolean; onCommand: (command: EmbeddedIssueHeaderAction) => void }) {
  return <ActorDirectoryBoundary><EmbeddedIssueShellHeaderContent issue={issue} sidebarOpen={sidebarOpen} onCommand={onCommand} /></ActorDirectoryBoundary>;
}

function EmbeddedIssueShellHeaderContent({ issue, sidebarOpen, onCommand }: { issue: Issue; sidebarOpen: boolean; onCommand: (command: EmbeddedIssueHeaderAction) => void }) {
  const wsId = useWorkspaceId();
  const paths = useWorkspacePaths();
  const { t } = useT("issues");
  const { t: common } = useT("common");
  const actions = useIssueActions(issue);
  const showInSidebar = useShowInSidebar(issue);
  const archivedInboxItemId = useArchivedInboxItemId(issue.id, true);
  const { data: parent } = useQuery({ ...issueDetailOptions(wsId, issue.parent_issue_id ?? ""), enabled: !!issue.parent_issue_id });
  const { data: project } = useQuery({ ...projectDetailOptions(wsId, issue.project_id ?? ""), enabled: !!issue.project_id });
  return <div data-slot="embedded-issue-shell-header" className="flex h-full min-w-0 flex-1 items-center gap-2 text-body" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
    <div className="flex min-w-[min(8rem,35%)] flex-1 items-center gap-1.5">
      {parent ? <><AppLink href={paths.issueDetail(parent.id)} className="shrink-0 text-muted-foreground hover:text-foreground">{parent.identifier}</AppLink><ChevronRight className="size-3 shrink-0 text-faint-foreground" /></> : project ? <><AppLink href={paths.projectDetail(project.id)} className="flex max-w-72 min-w-0 items-center gap-1 text-muted-foreground hover:text-foreground"><ProjectIcon project={project} size="sm" /><span className="truncate">{project.title}</span></AppLink><ChevronRight className="size-3 shrink-0 text-faint-foreground" /></> : null}
      <AppLink href={paths.issueDetail(issue.id)} className="flex min-w-0 transition-opacity hover:opacity-80"><span className="truncate font-medium text-foreground">{issue.identifier} {issue.title}</span></AppLink>
    </div>
    <div className="flex min-w-0 shrink items-center gap-1">
      <div className="min-w-9 max-w-44 shrink overflow-hidden empty:hidden [&>div]:min-w-0 [&>div]:max-w-full [&_button]:min-w-0 [&_button]:max-w-full [&_button]:overflow-hidden"><IssueAgentHeaderChip issueId={issue.id} onJumpToRun={(taskId) => onCommand({ command: "jump-to-run", taskId })} /></div>
      <div className="min-w-9 max-w-40 shrink overflow-hidden empty:hidden [&>button]:max-w-full [&>button]:overflow-hidden [&>button]:px-1"><IssueWakeupHeaderChip issueId={issue.id} onOpen={() => onCommand({ command: "open-wakeups" })} /></div>
      <div className="flex shrink-0 items-center gap-1">
        <IssueInboxActions issueId={issue.id} onMarkDone={issueBehavesAsAny(issue, ["done", "closed"]) ? undefined : (onSaved) => actions.updateField({ status: "done" }, { onSuccess: onSaved })} />
        <IconButton label={actions.isPinned ? t(($) => $.detail.unpin_tooltip) : t(($) => $.detail.pin_tooltip)} tooltipSide="bottom" className={cn("text-muted-foreground", actions.isPinned && "text-foreground")} onClick={actions.togglePin}>{actions.isPinned ? <PinOff /> : <Pin />}</IconButton>
        <IssueActionsDropdown issue={issue} align="end" archivedInboxItemId={archivedInboxItemId} onShowInSidebar={showInSidebar ?? undefined} trigger={<IconButton label={common(($) => $.more_actions)} tooltipSide="bottom" className="text-muted-foreground"><MoreHorizontal /></IconButton>} />
        <IconButton label={t(($) => $.detail.sidebar_tooltip)} shortcut={<ActionShortcutKeycaps action="toggleRightSidebar" />} tooltipSide="bottom" variant={sidebarOpen ? "secondary" : "ghost"} className={sidebarOpen ? "" : "text-muted-foreground"} onClick={() => onCommand({ command: "toggle-sidebar" })}><PanelRight /></IconButton>
      </div>
    </div>
  </div>;
}
