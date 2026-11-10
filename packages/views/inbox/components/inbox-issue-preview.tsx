"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspacePaths } from "@multica/core/paths";
import { issueDetailOptions } from "@multica/core/issues/queries";
import { ActorDirectoryBoundary } from "@multica/core/workspace/actor-directory";
import { selectStandaloneAttachments } from "@multica/core/attachments/image-sequence";
import { isDeletedComment } from "@multica/core/issues/comment-deletion";
import { Button } from "@multica/ui/components/ui/button";
import { PanelRight } from "@multica/ui/icons";
import { ActorAvatar } from "../../common/actor-avatar";
import { Attachment, AttachmentDownloadProvider, ReadonlyContent } from "../../editor";
import { useNavigation } from "../../navigation";
import { useT, useTimeAgo } from "../../i18n";
import { useIssueActions } from "../../issues/actions/use-issue-actions";
import { useIssueTimeline } from "../../issues/hooks/use-issue-timeline";
import { AssigneePicker, DueDatePicker, LabelPicker, PriorityPicker, StatusPicker } from "../../issues/components/pickers";
import { IssueProjectPicker } from "../../projects/components/issue-project-picker";
import { ReplyInput } from "../../issues/components/reply-input";
import { CommentInput } from "../../issues/components/comment-input";
import { selectInboxConversation } from "./inbox-conversation";
import { scrollInboxTargetIntoView } from "./scroll-inbox-target";

const LightweightInboxContext = createContext({ enabled: false, replyLimit: 6 });
export const LightweightInboxProvider = LightweightInboxContext.Provider;
type PreviewProps = { issueId: string; highlightCommentId?: string; highlightRequestToken?: number; leadingAction?: ReactNode };
export function InboxIssueContent({ children, ...props }: PreviewProps & { children: ReactNode }) {
  return useContext(LightweightInboxContext).enabled ? <InboxIssuePreview {...props} /> : <>{children}</>;
}

export function InboxIssuePreview(props: PreviewProps) {
  return <ActorDirectoryBoundary><InboxIssuePreviewContent {...props} /></ActorDirectoryBoundary>;
}

function InboxIssuePreviewContent({ issueId, highlightCommentId, highlightRequestToken, leadingAction }: PreviewProps) {
  const { t } = useT("inbox");
  const { replyLimit } = useContext(LightweightInboxContext);
  const { t: issueT } = useT("issues");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsId = useWorkspaceId();
  const user = useAuthStore((state) => state.user);
  const paths = useWorkspacePaths();
  const navigation = useNavigation();
  const timeAgo = useTimeAgo();
  const issueQuery = useQuery(issueDetailOptions(wsId, issueId));
  const issue = issueQuery.data ?? null;
  const actions = useIssueActions(issue);
  const { timeline, loading, isError, refetch, submitReply, submitComment } = useIssueTimeline(issueId, user?.id);
  const selected = useMemo(() => selectInboxConversation(timeline, highlightCommentId, replyLimit), [timeline, highlightCommentId, replyLimit]);
  const targetRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightCommentId && !loading && !selected.targetMissing && scrollerRef.current && targetRef.current) scrollInboxTargetIntoView(scrollerRef.current, targetRef.current);
  }, [issueId, highlightCommentId, highlightRequestToken, loading, selected.targetMissing]);
  const fullPath = `${paths.issueDetail(issue?.identifier ?? issueId)}${highlightCommentId ? `#comment-${encodeURIComponent(highlightCommentId)}` : ""}`;

  return <div className="flex min-h-0 flex-1 flex-col bg-background">
    <div className="flex min-h-12 shrink-0 items-center gap-2 border-b px-4 py-2">
      {leadingAction}
      <div className="min-w-0 flex-1">
        <div className="text-caption text-muted-foreground">{issue?.identifier}</div>
        <div className="truncate text-body font-medium">{issue?.title ?? ""}</div>
      </div>
      {issue && <StatusPicker status={issue.status} projectId={issue.project_id} issue={issue} onUpdate={actions.updateField} align="end" />}
      <Button variant="outline" size="sm" onClick={() => navigation.push(fullPath)}>{t(($) => $.detail.preview_open_issue)}</Button>
      <Button variant={sidebarOpen ? "secondary" : "ghost"} size="icon-sm" aria-label={issueT(($) => $.detail.sidebar_tooltip)} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><PanelRight /></Button>
    </div>
    <div className="flex min-h-0 min-w-0 flex-1">
    <div ref={scrollerRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        {(loading || issueQuery.isLoading) && <div role="status" className="py-8 text-center text-muted-foreground">{t(($) => $.detail.preview_loading)}</div>}
        {!loading && isError && <div role="alert" className="py-4 text-muted-foreground">{t(($) => $.detail.preview_load_failed)} <Button size="sm" variant="outline" onClick={() => void refetch()}>{t(($) => $.list.retry)}</Button></div>}
        {!loading && !isError && selected.targetMissing && <div role="status" className="py-4 text-muted-foreground">{t(($) => $.detail.preview_missing)}</div>}
        {!loading && !isError && !selected.targetMissing && selected.entries.length === 0 && <div className="py-4 text-muted-foreground">{t(($) => $.detail.preview_no_messages)}</div>}
        {!loading && !isError && !selected.targetMissing && !!selected.hiddenCount && <div className="text-caption text-muted-foreground">{t(($) => $.detail.preview_older_hidden)}</div>}
        {!loading && !isError && !selected.targetMissing && selected.entries.map((entry) => {
          const attachments = entry.attachments ?? [];
          const standalone = selectStandaloneAttachments(entry.content, attachments);
          return <div key={entry.id} ref={entry.id === highlightCommentId ? targetRef : undefined} id={`inbox-preview-comment-${entry.id}`} className={`rounded-lg border border-surface-border bg-surface p-3 ${entry.id === highlightCommentId ? "ring-1 ring-brand" : ""}`}>
            <div className="mb-2 flex items-center gap-2">
              <ActorAvatar actorType={entry.actor_type} actorId={entry.actor_id} name={entry.actor_name} avatarUrl={entry.actor_avatar_url} size="sm" enableHoverCard showStatusDot />
              <span className="text-body font-medium">{entry.actor_name || entry.actor_type}</span>
              <span className="text-caption text-muted-foreground">{timeAgo(entry.created_at)}</span>
            </div>
            {!isDeletedComment(entry) && <AttachmentDownloadProvider attachments={attachments}>
              <ReadonlyContent content={entry.content ?? ""} attachments={attachments} />
              {standalone.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{standalone.map((attachment) => <Attachment key={attachment.id} attachment={{ kind: "record", attachment }} layout="card" />)}</div>}
            </AttachmentDownloadProvider>}
          </div>;
        })}
        {!loading && !isError && !selected.targetMissing && user && (selected.rootId
          ? <ReplyInput issueId={issueId} parentId={selected.rootId} avatarType="member" avatarId={user.id} draftKey={`reply:${issueId}:${selected.rootId}`} onSubmit={(content, attachmentIds, suppress, steer) => submitReply(selected.rootId!, content, attachmentIds, suppress, steer)} />
          : <CommentInput issueId={issueId} onSubmit={submitComment} />)}
      </div>
    </div>
    {sidebarOpen && issue && <aside className="w-64 max-w-[40%] shrink-0 overflow-y-auto border-l px-3 py-4" aria-label={issueT(($) => $.detail.section_properties)}>
      <div className="mb-3 px-1 text-label font-medium">{issueT(($) => $.detail.section_properties)}</div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-label">
        <span className="text-muted-foreground">{issueT(($) => $.detail.prop_assignee)}</span><AssigneePicker assigneeType={issue.assignee_type} assigneeId={issue.assignee_id} onUpdate={actions.updateField} align="start" />
        <span className="text-muted-foreground">{issueT(($) => $.detail.prop_project)}</span><IssueProjectPicker projectId={issue.project_id} issue={issue} onUpdate={actions.updateField} />
        <span className="text-muted-foreground">{issueT(($) => $.detail.prop_priority)}</span><PriorityPicker priority={issue.priority} onUpdate={actions.updateField} align="start" />
        <span className="text-muted-foreground">{issueT(($) => $.detail.prop_due_date)}</span><DueDatePicker dueDate={issue.due_date} onUpdate={actions.updateField} />
        <span className="text-muted-foreground">{issueT(($) => $.detail.prop_labels)}</span><LabelPicker issueId={issue.id} align="start" />
      </div>
    </aside>}
    </div>
  </div>;
}
