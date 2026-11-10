"use client";

import { Fragment, Profiler, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, CornerUpLeft, ListChevronsDownUp, Copy, Link2, Loader2, MessageSquarePlus, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "@multica/ui/icons";
import { toast } from "sonner";
import { Card } from "@multica/ui/components/ui/card";
import { Button, buttonVariants } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@multica/ui/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { ActorAvatar } from "../../common/actor-avatar";
import { DeferredTooltip } from "../../common/deferred-tooltip";
import { ReactionBar } from "@multica/ui/components/common/reaction-bar";
import { QuickEmojiPicker } from "@multica/ui/components/common/quick-emoji-picker";
import { cn } from "@multica/ui/lib/utils";
import { copyText } from "@multica/ui/lib/clipboard";
import { ActorDirectoryBoundary, useActorDirectory } from "@multica/core/workspace/actor-directory";
import { useLocale, useTimeAgo } from "../../i18n";
import { ContentEditor, type ContentEditorRef, ReadonlyContent, useFileDropZone, FileDropOverlay, Attachment as AttachmentRenderer, AttachmentDownloadProvider, useUploadGate, useComposerSubmit } from "../../editor";
import { useCommentUploads } from "./use-comment-uploads";
import { FileUploadButton } from "@multica/ui/components/common/file-upload-button";
import { api, dispatchReasonCode, errorCode } from "@multica/core/api";
import { ReplyInput } from "./reply-input";
import { CommentTriggerChips } from "./comment-trigger-chips";
import { useCommentTriggerPreview } from "../hooks/use-comment-trigger-preview";
import { useRecipientActions } from "../hooks/use-recipient-actions";
import { SteerBadge, SteerReceipts } from "./steer-receipts";
import type { AgentTask, TimelineEntry, Attachment } from "@multica/core/types";
import { contentReferencesAttachment } from "@multica/core/types";
import { isDeletedComment } from "@multica/core/issues/comment-deletion";
import { commentSupplementReceipts, isSupplementInFlight } from "@multica/core/issues/run-steering";
import { useConfigStore } from "@multica/core/config";
import {
  orderStandaloneAttachments,
  selectStandaloneAttachments,
  standaloneAttachmentGroup,
} from "@multica/core/attachments/image-sequence";
import { useCommentCollapseStore, useCommentDraftStore } from "@multica/core/issues/stores";
import { useT } from "../../i18n";
import { CommentsFoldBar } from "./resolved-thread-bar";
import { deriveThreadResolution } from "./thread-utils";
import { RevisionConflictCompare } from "./revision-conflict-compare";
import { InlineCommentRun, PlacedInlineCommentRun, useInlineCommentRunState, type InlineCommentRunState } from "./inline-comment-run";
import { EMPTY_COMMENT_RUNS, isActiveCommentRun, isRunFailureNotice, orderThreadWithRuns, type CommentRun, type ThreadRunSlot } from "./comment-runs";
import { descriptionPreview } from "./description-preview";
import { replyPreview } from "./reply-preview";
import { captureReplyFoldAnchor, restoreReplyFoldAnchor } from "./reply-fold-anchor";
import { fadeReplyIn, fadeReplyOut } from "./reply-fold-motion";
import { recordIssueRender } from "../hooks/issue-render-profile";
import { useCommentAnnotations } from "./use-comment-annotations";
import { useAttachmentVersions } from "./deliverables/attachment-versions";
import { VersionBadge } from "./deliverables/version-badge";
import { useRunCommentMotion } from "./use-run-comment-motion";
import { WakeupSourceChip } from "./wakeup-source-chip";

const commentActionClassName =
  "text-muted-foreground aria-expanded:bg-transparent aria-expanded:hover:bg-muted dark:aria-expanded:hover:bg-muted/50";

const highlightedCommentBackgroundClass =
  "bg-[color-mix(in_srgb,var(--card)_95%,var(--brand)_5%)]";
const stickyHeaderFadeClass =
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-1 after:bg-[inherit] after:[mask-image:linear-gradient(to_bottom,#000,transparent)] after:[-webkit-mask-image:linear-gradient(to_bottom,#000,transparent)]";

function ProfileReply({ name, children }: { name: string; children: ReactNode }) {
  return process.env.NODE_ENV === "development" ? <Profiler id={name} onRender={(id, _phase, duration) => recordIssueRender(id, duration)}>{children}</Profiler> : children;
}

function StickyHeaderShell({
  className,
  sticky = true,
  highlighted,
  children,
}: {
  className?: string;
  sticky?: boolean;
  highlighted?: boolean;
  children: ReactNode;
}) {
  if (!sticky) {
    return (
      <div className={cn(highlighted && highlightedCommentBackgroundClass, className)}>
        {children}
      </div>
    );
  }

  // `mb-1` reserves room for the fade's `h-1` below the header, so at rest the
  // fade covers empty space instead of the first line of the body. Callers
  // take the same 4px out of their bottom padding.
  return (
    <div
      className={cn(
        "sticky top-0 z-10 mb-1 transition-colors duration-700",
        !highlighted && stickyHeaderFadeClass,
        highlighted ? highlightedCommentBackgroundClass : "bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Types

interface CommentCardProps {
  issueId: string;
  runs?: CommentRun[];
  runViewState?: InlineCommentRunState;
  enteringRunIds?: ReadonlySet<string>;
  entry: TimelineEntry;
  /**
   * Flat list of every nested reply under this thread root, in render order.
   * Computed once in `issue-detail.tsx`'s `timelineView` and stabilized so
   * the array reference only changes when *this* thread's replies change —
   * an unrelated thread receiving a new reply must NOT bust this card's
   * memo. Passing the full Map here used to do exactly that.
   */
  replies: TimelineEntry[];
  currentUserId?: string;
  /**
   * True when the current user is a workspace owner/admin and can therefore
   * moderate comments authored by anyone — restoring the admin override that
   * the backend already grants at `comment.go:507-512`. Computed once in
   * `issue-detail.tsx` and threaded down so neither this component nor
   * `CommentRow` has to rerun the rule per row.
   */
  canModerate?: boolean;
  onReply: (parentId: string, content: string, attachmentIds?: string[], suppressAgentIds?: string[], steerTaskIds?: string[]) => Promise<string | boolean>;
  onReplyAccepted?: (commentId: string) => void;
  onEdit: (commentId: string, content: string, attachmentIds: string[], suppressAgentIds?: string[], contentBase?: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
  onCreateSubIssue?: (commentId: string) => void;
  /** Resolve/unresolve any comment in this thread (commentId = the target row). */
  onResolveToggle?: (commentId: string, resolved: boolean) => void;
  /** Copy a deep link (`#comment-…`) to a single comment in this thread. */
  onCopyLink?: (commentId: string) => void;
  /** Scroll to and flash a comment in this thread. */
  onJumpToComment?: (commentId: string) => void;
  /**
   * When non-null, the thread root is currently rendered as a resolved-but-
   * expanded card. Pass a "Collapse" affordance into the header so the user
   * can fold the thread back to the bar; the parent owns the session state.
   */
  onCollapseResolved?: () => void;
  /**
   * Per-session set of thread ROOT ids whose reply-resolution fold is expanded.
   * Used only when a REPLY is the resolution (root-resolution folding is handled
   * one level up in issue-detail's resolved-bar). Keyed on root id.
   */
  expandedResolvedIds?: ReadonlySet<string>;
  onResolvedExpandChange?: (rootId: string, expand: boolean) => void;
  /** ID of the comment to highlight (flash animation). */
  highlightedCommentId?: string | null;
  /** Reveal a requested reply for a deep link or minimap jump. */
  requestedReplyId?: string | null;
  /** Page-wide search must include older replies in its DOM walk. */
  forceShowReplies?: boolean;
  onEditingChange?: (commentId: string, editing: boolean) => void;
  onCollapseReply?: (trigger: HTMLButtonElement) => void;
  onExpandReply?: () => void;
  replyIsCollapsed?: boolean;
  replyStatus?: string;
  preserveEditOnUnmount?: boolean;
  /** Render the root alone when replies are separate timeline items. */
  rootOnly?: boolean;
}

// Shared delete confirmation dialog

function DeleteCommentDialog({
  open,
  onOpenChange,
  onConfirm,
  hasReplies,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  hasReplies?: boolean;
}) {
  const { t } = useT("issues");
  // Only a server that declares it keeps the replies (#8296); an older one
  // deletes them with the comment, and the copy must say so.
  const keepsReplies = useConfigStore((s) => s.commentDeleteKeepRepliesSupported);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(($) => $.comment.delete_title)}</AlertDialogTitle>
          <AlertDialogDescription>
            {!hasReplies
              ? t(($) => $.comment.delete_desc)
              : keepsReplies
                ? t(($) => $.comment.delete_desc_replies_kept)
                : t(($) => $.comment.delete_desc_with_replies)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(($) => $.comment.cancel_action)}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t(($) => $.comment.delete_action)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Standalone attachment list — renders attachments not already in the markdown

export function AttachmentList({
  attachments,
  content,
  className,
  onRemove,
}: {
  attachments?: Attachment[];
  content?: string;
  className?: string;
  onRemove?: (attachmentId: string) => void;
}) {
  const versions = useAttachmentVersions();
  if (!attachments?.length) return null;
  // Skip attachments whose URL (stable or legacy) is already referenced in the
  // markdown content, and duplicates of the same file that are referenced.
  // Shared with the image-sequence builder (MUL-5752) so the cards rendered
  // here and the images the viewer pages through can't disagree — as is the
  // grouping below, so paging follows the screen (MUL-7649).
  const standalone = orderStandaloneAttachments(
    selectStandaloneAttachments(content, attachments),
  );
  if (!standalone.length) return null;

  const images = standalone.filter((a) => standaloneAttachmentGroup(a) === "image");
  const files = standalone.filter((a) => standaloneAttachmentGroup(a) === "file");
  const render = (a: Attachment) => {
    const version = versions?.get(a.id);
    return (
      <AttachmentRenderer
        key={a.id}
        attachment={{ kind: "record", attachment: a }}
        layout="card"
        badge={version ? <VersionBadge version={version} /> : undefined}
        editable={!!onRemove}
        onDelete={onRemove ? () => onRemove(a.id) : undefined}
      />
    );
  };

  // Every image shows at its full size, one under another, so it reads
  // without opening (MUL-7736). Every other file — HTML too: an uploaded file
  // is a deliverable to open, not part of the text — is a card in a grid, not
  // a full-width row each.
  return (
    <AttachmentDownloadProvider attachments={attachments}>
      <div className={cn("flex flex-col gap-2", className)}>
        {images.length > 0 && (
          <div className="flex flex-col items-start gap-2">{images.map(render)}</div>
        )}
        {files.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-2">
            {files.map(render)}
          </div>
        )}
      </div>
    </AttachmentDownloadProvider>
  );
}

function collectActiveAttachmentIds(
  content: string,
  attachments: Attachment[],
  retainedStandaloneIds?: Set<string> | null,
): string[] {
  const ids = new Set<string>();
  for (const attachment of attachments) {
    if (contentReferencesAttachment(content, attachment)) ids.add(attachment.id);
  }
  for (const id of retainedStandaloneIds ?? []) ids.add(id);
  return [...ids];
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function initialStandaloneAttachmentIds(entry: TimelineEntry): Set<string> {
  const content = entry.content ?? "";
  return new Set(
    (entry.attachments ?? [])
      .filter((attachment) => !contentReferencesAttachment(content, attachment))
      .map((attachment) => attachment.id),
  );
}

function retryableAgentFailureComment(entry: TimelineEntry): entry is TimelineEntry & { source_task_id: string } {
  return (
    entry.actor_type === "agent" &&
    entry.comment_type === "system" &&
    typeof entry.source_task_id === "string" &&
    entry.source_task_id.length > 0
  );
}

function TaskCommentRetryButton({
  issueId,
  taskId,
  className,
}: {
  issueId: string;
  taskId: string;
  className?: string;
}) {
  const { t } = useT("issues");
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await api.rerunIssue(issueId, taskId);
    } catch (e) {
      // Rerun re-checks the operator's invoke permission (MUL-4525); a
      // structured 403 is a permission block, not a transient failure.
      toast.error(
        dispatchReasonCode(e) === "invocation_not_allowed"
          ? t(($) => $.execution_log.retry_blocked)
          : e instanceof Error
            ? e.message
            : t(($) => $.execution_log.retry_failed),
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={cn("flex", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleRetry}
        disabled={retrying}
        aria-label={t(($) => $.execution_log.retry_task_aria)}
      >
        {retrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {t(($) => $.execution_log.retry_task_tooltip)}
      </Button>
    </div>
  );
}

// Shared edit-attachment state hook

const NEVER_STEER = () => false;

const virtualEditSessions = new Map<string, { base: string; retained: Set<string> | null }>();

function useEditAttachmentState(
  issueId: string,
  entry: TimelineEntry,
  onEdit: (commentId: string, content: string, attachmentIds: string[], suppressAgentIds?: string[], contentBase?: string) => Promise<void>,
  preserveOnUnmount = false,
) {
  const { t } = useT("issues");
  const { t: tEditor } = useT("editor");
  const draftKey = `edit:${issueId}:${entry.id}` as const;
  const session = preserveOnUnmount ? virtualEditSessions.get(draftKey) : undefined;
  const restoredDraft = session ? useCommentDraftStore.getState().getDraft(draftKey) ?? entry.content ?? "" : entry.content ?? "";
  const [editing, setEditing] = useState(!!session);
  const [initialValue, setInitialValue] = useState(restoredDraft);
  const [initialContentBase, setInitialContentBase] = useState(session?.base ?? entry.content ?? "");
  const [revisionConflict, setRevisionConflict] = useState(false);
  const editorRef = useRef<ContentEditorRef>(null);
  // Saving mid-upload would persist the edit without the file the user just
  // pasted in — same failure as posting a new comment.
  const uploadGate = useUploadGate(editorRef);
  const cancelledRef = useRef(false);
  const [content, setContent] = useState(restoredDraft);
  // Uploads for this edit session (MUL-5181) — coordinator-owned, persisted in
  // the draft store keyed by the edit draft so scroll-out/close no longer drops
  // an in-flight upload.
  // `gate` widens the editor gate with coordinator-owned placeholders — see
  // CommentInput.
  const { uploads, attachments: pendingAttachments, handleUpload, removeUpload, gate } =
    useCommentUploads(draftKey, { issueId }, uploadGate, editorRef);
  const [retainedStandaloneIds, setRetainedStandaloneIds] = useState<Set<string> | null>(session?.retained ?? null);
  useEffect(() => {
    if (preserveOnUnmount && editing) virtualEditSessions.set(draftKey, { base: initialContentBase, retained: retainedStandaloneIds });
  }, [preserveOnUnmount, editing, draftKey, initialContentBase, retainedStandaloneIds]);
  const triggerPreview = useCommentTriggerPreview({
    issueId,
    parentId: entry.parent_id ?? undefined,
    editingCommentId: entry.id,
    content: editing ? content : "",
  });
  // An edit neither steers nor stops a run: it can only skip a recipient.
  const { recipients, routing, setAction: setRecipientAction, reset: resetRecipients } = useRecipientActions({
    issueId,
    agents: triggerPreview.agents,
    allowSteer: false,
    steerByDefault: NEVER_STEER,
    resetKey: `${issueId}:${entry.id}:${entry.parent_id ?? ""}`,
  });

  const editorAttachments = pendingAttachments.length > 0
    ? [...(entry.attachments ?? []), ...pendingAttachments]
    : entry.attachments;

  useEffect(() => {
    if (revisionConflict) setInitialContentBase(entry.content ?? "");
  }, [entry.content, revisionConflict]);

  const { isDragOver, dropZoneProps } = useFileDropZone({
    onDrop: (files) => files.forEach((f) => editorRef.current?.uploadFile(f)),
    enabled: editing,
  });

  const getDraft = useCommentDraftStore.getState().getDraft;
  const setDraft = useCommentDraftStore((s) => s.setDraft);
  const clearDraft = useCommentDraftStore((s) => s.clearDraft);

  const standaloneEditAttachments = (entry.attachments ?? []).filter((a) =>
    retainedStandaloneIds?.has(a.id),
  );

  const resetState = () => {
    if (preserveOnUnmount) virtualEditSessions.delete(draftKey);
    setEditing(false);
    setRevisionConflict(false);
    setContent(entry.content ?? "");
    resetRecipients();
    setRetainedStandaloneIds(null);
    // clearDraft drops both the edit text and its pending attachments.
    clearDraft(draftKey);
  };

  const startEdit = () => {
    cancelledRef.current = false;
    const draft = getDraft(draftKey) ?? entry.content ?? "";
    if (preserveOnUnmount) virtualEditSessions.set(draftKey, { base: entry.content ?? "", retained: initialStandaloneAttachmentIds(entry) });
    setInitialValue(draft);
    setInitialContentBase(entry.content ?? "");
    setContent(draft);
    setRetainedStandaloneIds(initialStandaloneAttachmentIds(entry));
    setEditing(true);
  };

  const cancelEdit = () => {
    cancelledRef.current = true;
    resetState();
  };

  /**
   * Discard the local draft and continue from the version the server holds.
   * Local-only — the server already stores this content, so nothing is written.
   * The editor is dirty (that is why the conflict exists), so `adoptContent` is
   * the only channel that lands: a plain `defaultValue` change is mount-only.
   */
  const adoptServerVersion = () => {
    const serverContent = entry.content ?? "";
    editorRef.current?.adoptContent(serverContent);
    setContent(serverContent);
    setDraft(draftKey, serverContent);
    setInitialContentBase(serverContent);
    setRevisionConflict(false);
  };

  // Await-then-render save (MUL-5181): shared submit contract, with the edit-
  // only concerns folded into onSubmit — the cancel-race guard, the no-op
  // short-circuit, and the failure toast. The hook owns the empty guard,
  // upload re-check, single-flight, and lock/spin via `submitting`.
  // Stale-submit guard (MUL-5181 P0) — see CommentInput. The edit hook lives
  // in CommentRow, so "unmounted" here means the issue detail closed.
  const editMountedRef = useRef(true);
  useEffect(() => {
    editMountedRef.current = true;
    return () => {
      editMountedRef.current = false;
    };
  }, []);
  const submittedEntryRef = useRef<unknown>(null);

  const { submitting: saving, submit: saveEdit } = useComposerSubmit({
    editorRef,
    uploadGate: gate,
    onSubmit: async (trimmed) => {
      // A save racing a just-pressed Cancel must never reach the server.
      if (cancelledRef.current) return false;
      // Flush pending debounce before snapshotting — see CommentInput.
      const pendingMd = editorRef.current?.flushPendingUpdate?.();
      if (pendingMd != null) setDraft(draftKey, pendingMd);
      submittedEntryRef.current = useCommentDraftStore.getState().drafts[draftKey];
      const activeIds = collectActiveAttachmentIds(
        trimmed,
        [...(entry.attachments ?? []), ...pendingAttachments],
        // Body-referenced + retained-standalone only (MUL-5181): an upload the
        // user removed from the body is really unbound. Close-surviving
        // uploads are written back into the body by the settle handler.
        retainedStandaloneIds,
      );
      const attachmentsChanged = !sameIdSet(activeIds, (entry.attachments ?? []).map((a) => a.id));
      // Nothing changed — close the editor without a write. Accepted, so
      // onAccepted resets the edit state.
      if (trimmed === (entry.content ?? "").trim() && !attachmentsChanged) {
        return true;
      }
      const { suppressAgentIds } = routing;
      try {
        await onEdit(
          entry.id,
          trimmed,
          activeIds,
          suppressAgentIds.length > 0 ? suppressAgentIds : undefined,
          initialContentBase,
        );
        setRevisionConflict(false);
        return true;
      } catch (err) {
        if (errorCode(err) === "revision_conflict") {
          setRevisionConflict(true);
        }
        toast.error(
          errorCode(err) === "revision_conflict"
            ? t(($) => $.revision.conflict)
            : err instanceof Error && err.message
            ? err.message
            : t(($) => $.comment.update_failed),
        );
        return false;
      }
    },
    onAccepted: () => {
      // Success may only consume the entry it submitted: edits made during the
      // save survive, and the editor then STAYS in edit mode on them.
      const lateMd = editorRef.current?.flushPendingUpdate?.();
      if (lateMd != null) setDraft(draftKey, lateMd);
      const store = useCommentDraftStore.getState();
      const live = store.drafts[draftKey];
      const untouched = live === undefined || live === submittedEntryRef.current;
      if (!editMountedRef.current) {
        if (untouched) { store.clearDraft(draftKey); if (preserveOnUnmount) virtualEditSessions.delete(draftKey); }
        return;
      }
      if (!untouched) return;
      resetState();
    },
  });

  return {
    editing,
    saving,
    uploading: gate.uploading,
    onUploadingChange: gate.onUploadingChange,
    uploadingLabel: tEditor(($) => $.upload.in_progress),
    editorRef,
    editorAttachments,
    handleUpload,
    uploads,
    removeUpload,
    isDragOver,
    dropZoneProps,
    triggerPreview,
    content,
    recipients,
    setRecipientAction,
    draftKey,
    setDraft,
    setContent,
    clearDraft,
    initialValue,
    standaloneEditAttachments,
    retainedStandaloneIds,
    setRetainedStandaloneIds,
    startEdit,
    cancelEdit,
    saveEdit,
    revisionConflict,
    adoptServerVersion,
  };
}

function CommentRevisionConflict({
  serverContent,
  localContent,
  onKeepLocal,
  onUseServer,
  saving,
}: {
  serverContent: string;
  localContent: string;
  onKeepLocal: () => void;
  onUseServer: () => void;
  saving?: boolean;
}) {
  const { t } = useT("issues");
  return (
    <RevisionConflictCompare
      className="mt-2"
      title={t(($) => $.revision.compare_comment)}
      serverLabel={t(($) => $.revision.server_version)}
      localLabel={t(($) => $.revision.local_version)}
      serverValue={serverContent}
      localValue={localContent}
      serverAction={(
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onUseServer}
        >
          {t(($) => $.revision.use_server)}
        </Button>
      )}
      localAction={(
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={onKeepLocal}
        >
          {t(($) => $.revision.keep_local)}
        </Button>
      )}
    />
  );
}

// Single comment row (used for both parent and replies within the same Card)

function CommentRow({
  runHeader,
  runMetadata,
  replyTo,
  issueId,
  entry,
  currentUserId,
  canModerate = false,
  isResolution = false,
  isHighlighted = false,
  hasReplies = false,
  onEdit,
  onDelete,
  onToggleReaction,
  onCreateSubIssue,
  onResolveToggle,
  onCopyLink,
  onEditingChange,
  onCollapseReply,
  onExpandReply,
  replyIsCollapsed = false,
  replyStatus,
  preserveEditOnUnmount = false,
}: {
  runHeader?: ReactNode;
  runMetadata?: ReactNode;
  replyTo?: ReactNode;
  issueId: string;
  entry: TimelineEntry;
  currentUserId?: string;
  canModerate?: boolean;
  /** True when this reply is the thread's resolution (shows the green badge). */
  isResolution?: boolean;
  /** True when other replies answer this one; they are kept when it is deleted. */
  hasReplies?: boolean;
  /** True when this row is the deep-link target currently being highlighted. */
  isHighlighted?: boolean;
  onEdit: (commentId: string, content: string, attachmentIds: string[], suppressAgentIds?: string[], contentBase?: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
  onCreateSubIssue?: (commentId: string) => void;
  onResolveToggle?: (commentId: string, resolved: boolean) => void;
  onCopyLink?: (commentId: string) => void;
  onEditingChange?: (commentId: string, editing: boolean) => void;
  onCollapseReply?: (trigger: HTMLButtonElement) => void;
  onExpandReply?: () => void;
  replyIsCollapsed?: boolean;
  replyStatus?: string;
  preserveEditOnUnmount?: boolean;
}) {
  const { t } = useT("issues");
  const locale = useLocale();
  const timeAgo = useTimeAgo();
  const { getActorName } = useActorDirectory();

  const edit = useEditAttachmentState(issueId, entry, onEdit, preserveEditOnUnmount);
  useLayoutEffect(() => {
    if (!edit.editing || !onEditingChange) return;
    onEditingChange(entry.id, true);
    return () => onEditingChange(entry.id, false);
  }, [edit.editing, entry.id, onEditingChange]);

  const isOwn = entry.actor_type === "member" && entry.actor_id === currentUserId;
  // A message that steered a run is part of that run's input: it cannot be
  // rewritten, and it cannot be removed while a turn is still receiving it.
  const receipts = commentSupplementReceipts(entry);
  const canEditEntry = receipts.length === 0 && (isOwn || (canModerate && entry.actor_type === "member"));
  const canDeleteEntry = !receipts.some(isSupplementInFlight) && (isOwn || canModerate);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const reactions = entry.reactions ?? [];

  // A deleted reply renders nothing at all. Its row is kept only so the
  // replies to it keep a direct parent (#8296), and the thread renders those
  // replies flat, in its place — a placeholder row would say nothing they do
  // not already say. Callers drop this row's chrome too, so the thread shows
  // no empty divider where it was.
  if (isDeletedComment(entry)) return null;

  return (
    <div data-comment-block className={replyIsCollapsed ? undefined : "pb-3"}>
      {/* Header pins to the timeline's scroll parent within this reply's own
          row box, so a LONG reply keeps its
          author + actions visible while you scroll its body, then releases once
          this reply ends. The header stays opaque and matches this comment's
          highlight state while it occludes the body scrolling underneath. */}
      <ProfileReply name="reply-header"><StickyHeaderShell
        highlighted={isHighlighted}
        className={cn("flex items-center gap-2.5 px-4 max-md:px-3", onCollapseReply ? "py-2" : "pt-3 pb-1")}
      >
        {onCollapseReply && <button type="button" disabled={edit.editing}
          onClick={(event) => replyIsCollapsed ? onExpandReply?.() : onCollapseReply(event.currentTarget)}
          data-reply-fold-id={replyIsCollapsed ? entry.id : undefined}
          aria-expanded={!replyIsCollapsed} aria-label={`${replyIsCollapsed ? t(($) => $.comment.expand_reply) : t(($) => $.comment.collapse_reply)}: ${entry.actor_name || getActorName(entry.actor_type, entry.actor_id)} ${replyPreview(entry)}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"><ChevronRight data-reply-fold-icon aria-hidden className={cn("h-4 w-4", !replyIsCollapsed && "rotate-90")} /></button>}
        <ProfileReply name="reply-avatar"><ActorAvatar
          actorType={entry.actor_type}
          actorId={entry.actor_id}
          name={entry.actor_name}
          avatarUrl={entry.actor_avatar_url}
          profileRequiresDirectoryEntry
          size="md"
          enableHoverCard
          showStatusDot
        /></ProfileReply>
        <span className="cursor-pointer text-body font-medium">
          {entry.actor_name || getActorName(entry.actor_type, entry.actor_id)}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="text-label text-muted-foreground cursor-default">
                {timeAgo(entry.created_at)}
              </span>
            }
          />
          <TooltipContent side="top">
            {new Date(entry.created_at).toLocaleString(locale)}
          </TooltipContent>
        </Tooltip>

        {replyStatus && <span className="shrink-0 text-caption text-muted-foreground">{replyStatus}</span>}

        <SteerBadge issueId={issueId} entry={entry} />
        {runHeader}

        {entry.actor_type === "agent" && entry.source_task_id && (
          <WakeupSourceChip issueId={issueId} taskId={entry.source_task_id} />
        )}

        {isResolution && (
          <span className="text-caption font-medium text-success">
            {t(($) => $.comment.resolve.resolution_badge)}
          </span>
        )}

        <ProfileReply name="reply-actions"><div data-comment-actions className="ml-auto flex shrink-0 items-center gap-0.5">
          {!edit.editing && <QuickEmojiPicker
            onSelect={(emoji) => onToggleReaction(entry.id, emoji)}
            ariaLabel={t(($) => $.comment.add_reaction)}
            align="end"
            className={buttonVariants({ variant: "ghost", size: "icon-sm", className: commentActionClassName })}
          />}
          <DropdownMenu open={actionsOpen} onOpenChange={setActionsOpen}>
            <DeferredTooltip
              content={t(($) => $.comment.more_actions)}
              trigger={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={commentActionClassName}
                      aria-label={t(($) => $.comment.more_actions)}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                />
              }
            />
            {actionsOpen && <DropdownMenuContent align="end">
              {/* Groups: act on it (edit, resolve), take it elsewhere, then delete alone. */}
              {canEditEntry && (
                <DropdownMenuItem onClick={edit.startEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t(($) => $.comment.edit_action)}
                </DropdownMenuItem>
              )}
              {onResolveToggle && (
                isResolution ? (
                  <DropdownMenuItem onClick={() => onResolveToggle(entry.id, false)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t(($) => $.comment.resolve.unresolve_action)}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onResolveToggle(entry.id, true)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t(($) => $.comment.resolve.resolve_with_comment_action)}
                  </DropdownMenuItem>
                )
              )}
              {(canEditEntry || onResolveToggle) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => {
                void copyText(entry.content ?? "").then((ok) => {
                  if (ok) toast.success(t(($) => $.comment.copied_toast));
                });
              }}>
                <Copy className="h-3.5 w-3.5" />
                {t(($) => $.comment.copy_action)}
              </DropdownMenuItem>
              {onCopyLink && (
                <DropdownMenuItem onClick={() => onCopyLink(entry.id)}>
                  <Link2 className="h-3.5 w-3.5" />
                  {t(($) => $.comment.copy_link_action)}
                </DropdownMenuItem>
              )}
              {onCreateSubIssue && entry.comment_type === "comment" && (
                <DropdownMenuItem onClick={() => onCreateSubIssue(entry.id)}>
                  <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                  {t(($) => $.source_context.create_action)}
                </DropdownMenuItem>
              )}
              {canDeleteEntry && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setConfirmDelete(true)} variant="destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    {t(($) => $.comment.delete_action)}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>}
          </DropdownMenu>
          <DeleteCommentDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            onConfirm={() => onDelete(entry.id)}
            hasReplies={hasReplies}
          />
        </div></ProfileReply>
      </StickyHeaderShell></ProfileReply>
      {!replyIsCollapsed && <ProfileReply name="reply-content"><div data-reply-motion-body>
      {replyTo && <div className="pl-12 pr-4 max-md:pl-3 max-md:pr-3 pb-1.5">{replyTo}</div>}

      {edit.editing ? (
        <div
          {...edit.dropZoneProps}
          className="relative pl-12 pr-4 max-md:pl-3 max-md:pr-3 pt-1"
          onKeyDown={(e) => { if (e.key === "Escape") edit.cancelEdit(); }}
        >
          <div className="text-body leading-relaxed">
            <ContentEditor
              ref={edit.editorRef}
              defaultValue={edit.initialValue}
              placeholder={t(($) => $.comment.edit_placeholder)}
              onUpdate={(md) => {
                edit.setContent(md);
                if (md.trim().length > 0) edit.setDraft(edit.draftKey, md);
                else edit.clearDraft(edit.draftKey);
              }}
              onSubmit={edit.saveEdit}
              onUploadFile={edit.handleUpload}
              onUploadingChange={edit.onUploadingChange}
              debounceMs={100}
              flushPendingOnUnmount={preserveEditOnUnmount}
              currentIssueId={issueId}
              attachments={edit.editorAttachments}
            />
          </div>
          {edit.revisionConflict ? (
            <CommentRevisionConflict
              serverContent={entry.content ?? ""}
              localContent={edit.content}
              onKeepLocal={() => void edit.saveEdit()}
              onUseServer={edit.adoptServerVersion}
              saving={edit.saving}
            />
          ) : null}
          {edit.standaloneEditAttachments.length > 0 && (
            <AttachmentList
              attachments={edit.standaloneEditAttachments}
              className="mt-2 max-w-full"
              onRemove={(attachmentId) =>
                edit.setRetainedStandaloneIds((ids) => {
                  const next = new Set(ids ?? []);
                  next.delete(attachmentId);
                  return next;
                })
              }
            />
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="min-w-0 flex-1">
              <CommentTriggerChips
                recipients={edit.recipients}
                blocked={edit.triggerPreview.blocked}
                hasAllMembersMention={edit.triggerPreview.hasAllMembersMention}
                draftContent={edit.content}
                onActionChange={edit.setRecipientAction}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <FileUploadButton
                size="sm"
                multiple
                onSelect={(file) => edit.editorRef.current?.uploadFile(file)}
              />
              <Button size="sm" variant="ghost" onClick={edit.cancelEdit} disabled={edit.saving}>{t(($) => $.comment.cancel_edit)}</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={edit.saveEdit}
                disabled={edit.saving || edit.uploading}
                aria-disabled={edit.uploading || undefined}
                aria-busy={edit.uploading || undefined}
              >
                {edit.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {edit.uploading ? edit.uploadingLabel : t(($) => $.comment.save_action)}
              </Button>
            </div>
          </div>
          {edit.isDragOver && <FileDropOverlay />}
        </div>
      ) : (
        <>
          <div tabIndex={currentUserId ? 0 : undefined} role="group"
            aria-label={t(($) => $.reply.annotations.source_label, { name: entry.actor_name || getActorName(entry.actor_type, entry.actor_id) })}
            data-comment-content={entry.id} className="pl-12 pr-4 max-md:pl-3 max-md:pr-3 text-body leading-relaxed text-foreground">
            <ReadonlyContent content={entry.content ?? ""} attachments={entry.attachments} />
          </div>
          <AttachmentList attachments={entry.attachments} content={entry.content} className="mt-1.5 pl-12 pr-4 max-md:pl-3 max-md:pr-3" />
          <div className="pl-12 pr-4 max-md:pl-3 max-md:pr-3">
            <SteerReceipts issueId={issueId} entry={entry} />
          </div>
          {retryableAgentFailureComment(entry) && (
            <TaskCommentRetryButton
              issueId={issueId}
              taskId={entry.source_task_id}
              className="mt-2 pl-12 pr-4 max-md:pl-3 max-md:pr-3"
            />
          )}
        </>
      )}
      <div className="pl-12 pr-4 max-md:pl-3 max-md:pr-3">{runMetadata}</div>
      {!edit.editing && <ReactionBar
        reactions={reactions}
        showPicker={false}
        currentUserId={currentUserId}
        onToggle={(emoji) => onToggleReaction(entry.id, emoji)}
        getActorName={getActorName}
        className="mt-1.5 pl-12 pr-4 max-md:pl-3 max-md:pr-3"
      />}
      </div></ProfileReply>}
    </div>
  );
}

/** Names the input a run answers once other rows separate the two (MUL-7628). */
function ReplyToQuote({ entry, onJump }: { entry: TimelineEntry; onJump?: (commentId: string) => void }) {
  const { t } = useT("issues");
  const { getActorName } = useActorDirectory();
  const label = t(($) => $.comment.replying_to, {
    name: entry.actor_name || getActorName(entry.actor_type, entry.actor_id),
    preview: descriptionPreview(entry.content ?? ""),
  });
  return (
    <button type="button" disabled={!onJump} onClick={() => onJump?.(entry.id)} title={label}
      className="flex max-w-full min-w-0 items-center gap-1.5 rounded-xs text-left text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:text-muted-foreground">
      <CornerUpLeft aria-hidden className="size-3 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/** A run without a persisted reply still belongs to the agent, never its trigger author. */
export function AgentRunComment({ run, standalone = false, commentProps, entering = false, replyTo, highlightedId }: {
  run: CommentRun;
  standalone?: boolean;
  entering?: boolean;
  commentProps?: CommentCardProps;
  /** The input this run answers, shown when the thread no longer places the two together. */
  replyTo?: ReactNode;
  /** The flashed jump target: the slot's comment id, or the run's task id until it has one. */
  highlightedId?: string | null;
}) {
  const viewState = useInlineCommentRunState();
  const replyEntry = commentProps?.entry;
  // A deleted reply renders nothing in a run slot either (see CommentRow), so
  // the slot falls back to the run's own activity block: the run happened, and
  // it still carries `hasReply`, so it never prints the deleted body as its
  // output. A deleted thread ROOT keeps rendering — it heads its own thread.
  const replyHidden = !standalone && !!replyEntry && isDeletedComment(replyEntry);
  // The platform's failure notice only restates how the run ended, so the
  // run's own block takes its slot and says it once (MUL-7692). A standalone
  // notice that people replied to still heads its thread as a card.
  const notice = replyEntry && !replyHidden && isRunFailureNotice(replyEntry, run.task)
    && !(standalone && commentProps?.replies.some((entry) => !isDeletedComment(entry)))
    ? replyEntry : undefined;
  const reply = replyHidden || notice ? undefined : replyEntry;
  // The notice keeps its deep-link target and highlight in the run's slot.
  const slotEntry = reply ?? notice;
  const motionRef = useRunCommentMotion(entering, reply?.id, run.task.status);
  const highlighted = (highlightedId ?? commentProps?.highlightedCommentId) === (slotEntry?.id ?? run.task.id);
  return (
    <div ref={motionRef} data-run-slot-id={run.task.id} data-reply-motion-id={!standalone ? slotEntry?.id : undefined}
      data-run-comment-id={!reply ? run.task.id : undefined}
      id={!standalone && slotEntry ? `comment-${slotEntry.id}` : undefined}
      className={cn("transition-colors duration-700", standalone ? !reply && "rounded-xl border" : "border-t border-border/50", !reply && "py-1.5",
        highlighted ? highlightedCommentBackgroundClass : standalone && !reply && "bg-card")}>
      {commentProps && reply ? standalone ? (
        <CommentCard {...commentProps} runs={commentProps.runs ?? [run]} runViewState={viewState} />
      ) : (
        <CommentRow {...commentProps}
          isHighlighted={commentProps.highlightedCommentId === reply?.id}
          isResolution={!!reply?.resolved_at}
          replyTo={replyTo}
          runHeader={<PlacedInlineCommentRun run={run} viewState={viewState} presentation="header" />}
          runMetadata={<PlacedInlineCommentRun run={run} viewState={viewState} />} />
      ) : <div className="px-4 max-md:px-3">
        <InlineCommentRun run={run} viewState={viewState} showIdentity replyTo={replyTo} replacesFailureNotice={!!notice} />
      </div>}
    </div>
  );
}

// CommentCard — One Card per thread (parent + all replies flat inside)

// A virtualized outer timeline can unmount a thread while the reader scrolls.
// Keep explicit expansion in memory so returning to it does not fold it again.
const replyExpansionOverrides = new Map<string, boolean>();
const pendingThreadAnnotationEdits = new Map<string, { annotationId: string; sourceCommentId: string }>();
export function __resetOlderReplyExpansionForTests() { replyExpansionOverrides.clear(); }
function rememberReplyExpansion(key: string, expanded: boolean) {
  if (!replyExpansionOverrides.has(key) && replyExpansionOverrides.size >= 3000) replyExpansionOverrides.delete(replyExpansionOverrides.keys().next().value!);
  replyExpansionOverrides.set(key, expanded);
}

type ThreadReplyItemProps = Pick<CommentCardProps, "issueId" | "currentUserId" | "canModerate" | "onEdit" | "onDelete" | "onToggleReaction" | "onCreateSubIssue" | "onResolveToggle" | "onCopyLink" | "onJumpToComment" | "highlightedCommentId" | "requestedReplyId" | "forceShowReplies" | "enteringRunIds"> & {
  root: TimelineEntry;
  row: TimelineEntry | ThreadRunSlot;
  replies?: TimelineEntry[];
  hasReplies?: boolean;
  latestReplyId?: string;
  resolutionReplyId?: string;
  runs?: CommentRun[];
  onReply?: CommentCardProps["onReply"];
  threadEnd?: boolean;
};

const unavailableThreadReply: CommentCardProps["onReply"] = async () => false;

/** A reply that can be mounted independently of its thread root. */
export const ThreadReplyItem = memo(function ThreadReplyItem(props: ThreadReplyItemProps) {
  return <ActorDirectoryBoundary><ThreadReplyItemContent {...props} /></ActorDirectoryBoundary>;
});

function ThreadReplyItemContent({ root, row, latestReplyId, resolutionReplyId, replies = [], hasReplies, issueId, currentUserId, canModerate, onEdit, onDelete, onToggleReaction, onCreateSubIssue, onResolveToggle, onCopyLink, onJumpToComment, highlightedCommentId, requestedReplyId, forceShowReplies = false, enteringRunIds, runs = EMPTY_COMMENT_RUNS, onReply = unavailableThreadReply, threadEnd = false }: ThreadReplyItemProps) {
  const { t } = useT("issues");
  const { getActorName } = useActorDirectory();
  const reply = "run" in row ? row.reply : row;
  const annotation = useCommentAnnotations({ draftKey: `reply:${issueId}:${root.id}`, enabled: !!currentUserId,
    sources: reply ? [{ id: reply.id, name: reply.actor_name || getActorName(reply.actor_type, reply.actor_id), revision: reply.revision }] : [] });
  const replyId = reply?.id;
  const key = `${issueId}:${root.id}:${replyId ?? ""}`;
  const [, rerender] = useState(0);
  const [editing, setEditing] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const pendingEnter = useRef(false);
  const pendingAnchor = useRef<ReturnType<typeof captureReplyFoldAnchor>>(null);
  const pendingCancel = useRef<(() => void) | null>(null);
  const setExpanded = useCallback((expanded: boolean) => {
    if (!replyId || replyExpansionOverrides.get(key) === expanded) return;
    rememberReplyExpansion(key, expanded);
    rerender((version) => version + 1);
  }, [key, replyId]);
  useEffect(() => {
    if (replyId && replyId === latestReplyId && "run" in row && isActiveCommentRun(row.run.task) && !replyExpansionOverrides.has(key)) {
      rememberReplyExpansion(key, true);
    }
  }, [key, latestReplyId, replyId, row]);
  useEffect(() => {
    if (replyId && requestedReplyId === replyId) setExpanded(true);
  }, [replyId, requestedReplyId, setExpanded]);
  const expand = useCallback(() => { pendingEnter.current = true; setExpanded(true); }, [setExpanded]);
  const collapse = useCallback((trigger: HTMLButtonElement) => {
    if (!replyId || pendingCancel.current) return;
    const body = wrapper.current?.querySelector<HTMLElement>("[data-reply-motion-body]");
    const commit = () => {
      pendingCancel.current = null;
      pendingAnchor.current = captureReplyFoldAnchor(trigger, replyId);
      setExpanded(false);
    };
    if (!body) { commit(); return; }
    pendingCancel.current = () => {};
    const cancel = fadeReplyOut(body, commit);
    if (pendingCancel.current) pendingCancel.current = cancel;
  }, [replyId, setExpanded]);
  useEffect(() => () => { if (pendingCancel.current) { pendingCancel.current(); if (replyId) rememberReplyExpansion(key, false); } }, [key, replyId]);
  useLayoutEffect(() => {
    if (pendingEnter.current) {
      pendingEnter.current = false;
      const body = wrapper.current?.querySelector<HTMLElement>("[data-reply-motion-body]");
      if (body) fadeReplyIn(body);
    }
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    restoreReplyFoldAnchor(anchor);
    let frame = 0, remaining = 3;
    const cancel = () => { cancelAnimationFrame(frame); for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) anchor.scroller.removeEventListener(type, cancel); };
    const stabilize = () => { restoreReplyFoldAnchor(anchor); if (--remaining > 0) frame = requestAnimationFrame(stabilize); else cancel(); };
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) anchor.scroller.addEventListener(type, cancel, { passive: true });
    frame = requestAnimationFrame(stabilize);
    return cancel;
  });
  const handleEditing = useCallback((_id: string, value: boolean) => { setEditing(value); if (value) setExpanded(true); }, [setExpanded]);
  const expanded = !reply || isDeletedComment(reply) || forceShowReplies || editing || (replyExpansionOverrides.get(key) ?? reply.id === latestReplyId);
  useEffect(() => {
    const draftKey = `reply:${issueId}:${root.id}`;
    const pending = pendingThreadAnnotationEdits.get(draftKey);
    if (!pending || pending.sourceCommentId !== replyId || !expanded) return;
    let frame = 0, attempts = 0;
    const open = () => {
      if (pendingThreadAnnotationEdits.get(draftKey) !== pending) return;
      if (annotation.editAnnotation(pending.annotationId, false)) { pendingThreadAnnotationEdits.delete(draftKey); return; }
      if (++attempts < 120) frame = requestAnimationFrame(open);
    };
    frame = requestAnimationFrame(open);
    return () => cancelAnimationFrame(frame);
  }, [issueId, root.id, replyId, expanded]);
  const renderRuns = (presentation: "inline" | "header") => runs.filter((run) => run.commentId === replyId && run.hasReply && (!run.anchorCommentId || run.anchorCommentId === replyId || forceShowReplies))
    .map((run) => <PlacedInlineCommentRun key={run.task.id} run={run} presentation={presentation} />);
  const common = reply ? { issueId, entry: reply, replies: [], currentUserId, canModerate, onReply, onEdit, onDelete, onToggleReaction, onCreateSubIssue, onResolveToggle, onCopyLink, highlightedCommentId, enteringRunIds, onEditingChange: handleEditing, onCollapseReply: forceShowReplies ? undefined : collapse, onExpandReply: expand, replyIsCollapsed: !expanded, preserveEditOnUnmount: true } : undefined;
  return <div ref={(node) => { wrapper.current = node; annotation.cardRef.current = node; }} {...annotation.captureProps} className={cn("border-x border-surface-border bg-surface", threadEnd && "rounded-b-xl border-b")}>
    {annotation.popup}
    {"run" in row ? <AgentRunComment run={row.run} entering={enteringRunIds?.has(row.run.task.id)} highlightedId={highlightedCommentId}
      replyTo={row.replyTo && <ReplyToQuote entry={row.replyTo} onJump={onJumpToComment} />}
      commentProps={common ? { ...common, replyStatus: isActiveCommentRun(row.run.task) ? row.run.task.status === "running" ? t(($) => $.agent_activity.status_running) : t(($) => $.agent_activity.status_queued) : undefined } : undefined} />
      : !isDeletedComment(row) && common && <div id={`comment-${row.id}`} data-reply-motion-id={row.id} className={cn("border-t border-border/50 transition-colors duration-700", highlightedCommentId === row.id && highlightedCommentBackgroundClass)}>
        <CommentRow {...common} isHighlighted={highlightedCommentId === row.id} isResolution={row.id === resolutionReplyId}
          hasReplies={hasReplies ?? replies.some((child) => child.parent_id === row.id)} runHeader={renderRuns("header")} runMetadata={renderRuns("inline")} />
      </div>}
  </div>;
}

type ThreadComposerItemProps = Pick<CommentCardProps, "issueId" | "replies" | "currentUserId" | "onReply" | "onReplyAccepted" | "onJumpToComment"> & { root: TimelineEntry; runs?: CommentRun[] };

/** The thread's composer stays usable even when the root is virtualized away. */
export function ThreadComposerItem(props: ThreadComposerItemProps) {
  return <ActorDirectoryBoundary><ThreadComposerItemContent {...props} /></ActorDirectoryBoundary>;
}

function ThreadComposerItemContent({ root, replies, issueId, currentUserId, onReply, onReplyAccepted, onJumpToComment, runs = EMPTY_COMMENT_RUNS }: ThreadComposerItemProps) {
  const { t } = useT("issues");
  const { getActorName } = useActorDirectory();
  const wrapper = useRef<HTMLDivElement>(null);
  const replyTarget = useCommentDraftStore((s) => s.drafts[`reply:${issueId}:${root.id}`]?.replyTarget);
  const replyTargetId = replyTarget?.commentId ?? root.id;
  const missing = !!replyTarget && replyTargetId !== root.id && !replies.some((reply) => reply.id === replyTargetId && !isDeletedComment(reply));
  const annotation = useCommentAnnotations({ draftKey: `reply:${issueId}:${root.id}`, enabled: !!currentUserId, displayMarkers: false,
    sources: [root, ...replies].filter((entry) => entry.type === "comment").map((entry) => ({ id: entry.id, name: entry.actor_name || getActorName(entry.actor_type, entry.actor_id), revision: entry.revision })) });
  useLayoutEffect(() => {
    annotation.cardRef.current = wrapper.current?.closest<HTMLDivElement>("[data-issue-scroll-container]") ?? wrapper.current;
    return () => { annotation.cardRef.current = null; };
  }, [annotation.cardRef]);
  const steer = useCallback((task: AgentTask) => runs.some((run) => run.task.id === task.id), [runs]);
  return <div ref={wrapper} className="rounded-b-xl border border-t-0 border-surface-border bg-surface pb-0">
    {annotation.popup}
    <div className="border-t border-border/50 px-4 max-md:px-3 py-2.5">
      <ReplyInput issueId={issueId} parentId={replyTargetId} targetMissing={missing} placeholder={t(($) => $.reply.placeholder)} size="sm"
        avatarType="member" avatarId={currentUserId ?? ""} draftKey={`reply:${issueId}:${root.id}`}
        onEditAnnotation={(id) => {
          if (annotation.editAnnotation(id, true)) return true;
          const draftKey = `reply:${issueId}:${root.id}` as const;
          const saved = useCommentDraftStore.getState().getAnnotations(draftKey).find((item) => item.id === id);
          if (!saved || !onJumpToComment) return false;
          const scroller = wrapper.current?.closest<HTMLElement>("[data-issue-scroll-container]");
          if (scroller?.querySelector(`[data-comment-content=${JSON.stringify(saved.sourceCommentId)}]`)) return false;
          if (saved.sourceCommentId !== root.id && !replies.some((reply) => reply.id === saved.sourceCommentId && !isDeletedComment(reply))) return false;
          const pending = { annotationId: id, sourceCommentId: saved.sourceCommentId };
          pendingThreadAnnotationEdits.set(draftKey, pending);
          window.setTimeout(() => {
            if (pendingThreadAnnotationEdits.get(draftKey) !== pending) return;
            pendingThreadAnnotationEdits.delete(draftKey);
            toast.error(t(($) => $.reply.annotations.source_changed));
          }, 5000);
          const collapse = useCommentCollapseStore.getState();
          if (collapse.isCollapsed(issueId, root.id)) collapse.toggle(issueId, root.id);
          onJumpToComment(saved.sourceCommentId);
          return true;
        }} steerByDefault={steer}
        onSubmit={(content, attachments, suppress, taskIds) => missing ? Promise.resolve(false) : onReply(replyTargetId, content, attachments, suppress, taskIds)}
        onAccepted={onReplyAccepted} />
    </div>
  </div>;
}

export function ThreadResolutionItem({ root, replies, onResolvedExpandChange, folded, threadEnd = false }: {
  root: TimelineEntry; replies: TimelineEntry[]; onResolvedExpandChange: (id: string, expanded: boolean) => void; folded: boolean; threadEnd?: boolean;
}) {
  const { t } = useT("issues");
  if (folded) {
    const resolution = deriveThreadResolution(root, replies);
    const resolutionId = resolution.kind === "reply" ? resolution.resolutionId : undefined;
    return <div className={cn("border-x border-surface-border bg-surface px-4 max-md:px-3 py-2.5 border-t border-border/50", threadEnd && "rounded-b-xl border-b")}>
      <CommentsFoldBar replies={replies.filter((reply) => reply.id !== resolutionId && !isDeletedComment(reply))} onExpand={() => onResolvedExpandChange(root.id, true)} />
    </div>;
  }
  return <button type="button" onClick={(event) => {
    const scroller = event.currentTarget.closest("[data-issue-scroll-container]");
    if (scroller) window.dispatchEvent(new CustomEvent("multica:flush-scoped-editors", { detail: scroller }));
    onResolvedExpandChange(root.id, false);
  }} data-thread-sticky-bar className="sticky top-0 z-20 flex w-full items-center gap-2.5 border-x border-surface-border border-t border-border/50 bg-muted px-4 max-md:px-3 py-2.5 text-left text-body text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground"
    aria-label={t(($) => $.comment.resolve.collapse)}><ListChevronsDownUp className="h-3.5 w-3.5" />{t(($) => $.comment.resolve.collapse)}</button>;
}


// A quick action posts an ordinary comment and is rendered as one (MUL-5465).
// It briefly had a collapsed one-line header that expanded to reveal the
// prompt, on the theory that repeated runs would bury the discussion. In
// practice the prompts are short, the header restated what the body already
// said, and the disclosure only added a click between the reader and the text.
// Provenance still lives on `quick_action_id`; it is data, not decoration.

function CommentCardImpl({
  issueId,
  runs = EMPTY_COMMENT_RUNS,
  runViewState,
  enteringRunIds,
  entry,
  replies,
  currentUserId,
  canModerate = false,
  onReply,
  onReplyAccepted,
  onEdit,
  onDelete,
  onToggleReaction,
  onCreateSubIssue,
  onResolveToggle,
  onCopyLink,
  onJumpToComment,
  onCollapseResolved,
  expandedResolvedIds,
  onResolvedExpandChange,
  highlightedCommentId,
  requestedReplyId,
  forceShowReplies = false,
  onEditingChange,
  onCollapseReply,
  rootOnly = false,
}: CommentCardProps) {
  const { t } = useT("issues");
  const locale = useLocale();
  const timeAgo = useTimeAgo();
  const { getActorName } = useActorDirectory();
  const replyTarget = useCommentDraftStore((s) => s.drafts[`reply:${issueId}:${entry.id}`]?.replyTarget);
  const replyTargetId = replyTarget?.commentId ?? entry.id;
  // A deleted target's tombstone is as gone as a removed row.
  const replyTargetMissing = !!replyTarget && replyTargetId !== entry.id
    && !replies.some((r) => r.id === replyTargetId && !isDeletedComment(r));
  const annotation = useCommentAnnotations({
    draftKey: `reply:${issueId}:${entry.id}`,
    sources: [entry, ...replies].filter((e) => e.type === "comment")
      .map((e) => ({ id: e.id, name: e.actor_name || getActorName(e.actor_type, e.actor_id), revision: e.revision })),
    enabled: !!currentUserId,
    onAdded: () => { if (replyFolded) onResolvedExpandChange?.(entry.id, true); },
  });
  useEffect(() => {
    if (!rootOnly) return;
    const draftKey = `reply:${issueId}:${entry.id}`;
    const pending = pendingThreadAnnotationEdits.get(draftKey);
    if (!pending || pending.sourceCommentId !== entry.id) return;
    let frame = 0, attempts = 0;
    const open = () => {
      if (pendingThreadAnnotationEdits.get(draftKey) !== pending) return;
      if (annotation.editAnnotation(pending.annotationId, false)) { pendingThreadAnnotationEdits.delete(draftKey); return; }
      if (++attempts < 120) frame = requestAnimationFrame(open);
    };
    frame = requestAnimationFrame(open);
    return () => cancelAnimationFrame(frame);
  }, [rootOnly, issueId, entry.id]);
  const isCollapsed = useCommentCollapseStore((s) => s.isCollapsed(issueId, entry.id));
  const toggleCollapse = useCommentCollapseStore((s) => s.toggle);
  const open = !isCollapsed;
  const flushThreadEditors = useCallback(() => {
    const root = annotation.cardRef.current;
    if (root) window.dispatchEvent(new CustomEvent("multica:flush-scoped-editors", { detail: root }));
  }, [annotation.cardRef]);
  const handleToggle = useCallback(
    () => { if (open) flushThreadEditors(); toggleCollapse(issueId, entry.id); },
    [toggleCollapse, issueId, entry.id, open, flushThreadEditors],
  );

  const edit = useEditAttachmentState(issueId, entry, onEdit);
  const olderRepliesKey = `${issueId}:${entry.id}`;
  const [, setReplyExpansionVersion] = useState(0);
  const pendingFoldAnchor = useRef<ReturnType<typeof captureReplyFoldAnchor>>(null);
  const pendingFadeIn = useRef<{ id: string; expanded: boolean } | null>(null);
  const pendingFadeOut = useRef(new Map<string, () => void>());
  const [editingReplies, setEditingReplies] = useState<ReadonlySet<string>>(() => new Set());
  const seenActiveRuns = useRef(new Set<string>());
  const setReplyExpanded = useCallback((commentId: string, expanded: boolean) => {
    const key = `${olderRepliesKey}:${commentId}`;
    if (replyExpansionOverrides.get(key) === expanded) return;
    rememberReplyExpansion(key, expanded);
    setReplyExpansionVersion((version) => version + 1);
  }, [olderRepliesKey]);
  const expandReply = useCallback((commentId: string) => {
    pendingFadeIn.current = { id: commentId, expanded: true };
    setReplyExpanded(commentId, true);
  }, [setReplyExpanded]);
  const collapseReply = useCallback((commentId: string, trigger: HTMLButtonElement) => {
    if (pendingFadeOut.current.has(commentId)) return;
    const row = trigger.closest<HTMLElement>("[data-reply-motion-id]")?.querySelector<HTMLElement>("[data-reply-motion-body]");
    const commit = () => {
      pendingFadeOut.current.delete(commentId);
      pendingFoldAnchor.current = captureReplyFoldAnchor(trigger, commentId);
      setReplyExpanded(commentId, false);
    };
    if (!row) { commit(); return; }
    // Insert before starting, since disabled motion commits synchronously.
    pendingFadeOut.current.set(commentId, () => {});
    const cancel = fadeReplyOut(row, commit);
    if (pendingFadeOut.current.has(commentId)) pendingFadeOut.current.set(commentId, cancel);
  }, [setReplyExpanded]);
  useEffect(() => () => {
    for (const [id, cancel] of pendingFadeOut.current) {
      cancel();
      rememberReplyExpansion(`${olderRepliesKey}:${id}`, false);
    }
    pendingFadeOut.current.clear();
  }, [olderRepliesKey]);
  useLayoutEffect(() => {
    const pending = pendingFadeIn.current;
    if (!pending) return;
    pendingFadeIn.current = null;
    const attr = pending.expanded ? "data-reply-motion-id" : "data-reply-fold-id";
    const row = annotation.cardRef.current?.querySelector<HTMLElement>(`[${attr}=${JSON.stringify(pending.id)}]`);
    const body = pending.expanded ? row?.querySelector<HTMLElement>("[data-reply-motion-body]") : null;
    if (body) fadeReplyIn(body);
  });
  useLayoutEffect(() => {
    const anchor = pendingFoldAnchor.current;
    if (!anchor) return;
    pendingFoldAnchor.current = null;
    restoreReplyFoldAnchor(anchor);
    let frame = 0;
    let remaining = 3;
    const cancel = () => {
      cancelAnimationFrame(frame);
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) anchor.scroller.removeEventListener(type, cancel);
    };
    const stabilize = () => {
      restoreReplyFoldAnchor(anchor);
      if (--remaining > 0) frame = requestAnimationFrame(stabilize);
      else cancel();
    };
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) anchor.scroller.addEventListener(type, cancel, { passive: true });
    frame = requestAnimationFrame(stabilize);
    return cancel;
  });
  const handleReplyEditing = useCallback((commentId: string, editing: boolean) => {
    if (editing) setReplyExpanded(commentId, true);
    setEditingReplies((previous) => {
      if (previous.has(commentId) === editing) return previous;
      const next = new Set(previous);
      if (editing) next.add(commentId); else next.delete(commentId);
      return next;
    });
  }, [setReplyExpanded]);
  useLayoutEffect(() => {
    if (!edit.editing || !onEditingChange) return;
    onEditingChange(entry.id, true);
    return () => onEditingChange(entry.id, false);
  }, [edit.editing, entry.id, onEditingChange]);

  const isOwn = entry.actor_type === "member" && entry.actor_id === currentUserId;
  const receipts = commentSupplementReceipts(entry);
  const canEditEntry = receipts.length === 0 && (isOwn || (canModerate && entry.actor_type === "member"));
  const canDeleteEntry = !receipts.some(isSupplementInFlight) && (isOwn || canModerate);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A reply here goes into the running turn of a run that belongs to this
  // thread by default; another thread's turn is only reached by choice.
  const steerThreadRunByDefault = useCallback(
    (task: AgentTask) => runs.some((run) => run.task.id === task.id),
    [runs],
  );

  const allNestedReplies = replies;
  // What the thread shows. Tombstones are excluded from display and counts but
  // stay in `allNestedReplies`, which run anchoring and "has replies" reason
  // over. Every tombstone has at least one live descendant (the server prunes
  // one that loses its last reply), so no content hides behind this.
  const visibleReplies = allNestedReplies.filter((reply) => !isDeletedComment(reply));
  // A failure notice heading a thread keeps the thread's header; its run line
  // below says how the run ended, so the raw body and its button are dropped.
  const noticeRun = runs.find((run) => run.hasReply && run.commentId === entry.id && isRunFailureNotice(entry, run.task));
  const renderRuns = (commentId: string, presentation: "inline" | "header" = "inline") => runs.filter((run) => run.commentId === commentId && run.hasReply
    && (!run.anchorCommentId || run.anchorCommentId === commentId || replyFolded))
    .map((run) => <PlacedInlineCommentRun key={run.task.id} run={run} presentation={presentation}
      viewState={run.commentId === entry.id ? runViewState : undefined} replacesFailureNotice={run === noticeRun} />);

  // A run slot renders the run's latest comment, or its activity until it
  // posts one.
  const renderThreadRow = (row: TimelineEntry | ThreadRunSlot, collapsed = false) => "run" in row ? (
    <AgentRunComment key={row.run.task.id} run={row.run} entering={enteringRunIds?.has(row.run.task.id)}
      highlightedId={highlightedCommentId}
      replyTo={row.replyTo && <ReplyToQuote entry={row.replyTo} onJump={onJumpToComment} />}
      commentProps={row.reply ? {
        issueId, entry: row.reply, replies: [], currentUserId, canModerate, onReply, onEdit, onDelete,
        onToggleReaction, onCreateSubIssue, onResolveToggle, onCopyLink, highlightedCommentId, enteringRunIds,
        onEditingChange: handleReplyEditing,
        onCollapseReply: forceShowReplies || replyFolded ? undefined : (trigger) => collapseReply(row.reply!.id, trigger),
        onExpandReply: () => expandReply(row.reply!.id), replyIsCollapsed: collapsed,
        replyStatus: isActiveCommentRun(row.run.task) ? row.run.task.status === "running" ? t(($) => $.agent_activity.status_running) : t(($) => $.agent_activity.status_queued) : undefined,
      } : undefined} />
  ) : renderReply(row, collapsed);

  const renderReply = (reply: TimelineEntry, collapsed = false) => (
    <Fragment key={reply.id}>
      {/* A tombstone keeps its place in the thread but contributes no row
          of its own. */}
      {!isDeletedComment(reply) && (
        <div
          id={`comment-${reply.id}`}
          data-reply-motion-id={reply.id}
          className={cn(
            "border-t border-border/50 transition-colors duration-700",
            highlightedCommentId === reply.id && highlightedCommentBackgroundClass,
          )}
        >
          <CommentRow
            issueId={issueId}
            entry={reply}
            runHeader={renderRuns(reply.id, "header")}
            runMetadata={renderRuns(reply.id)}
            currentUserId={currentUserId}
            canModerate={canModerate}
            isResolution={reply.id === replyResolutionId}
            isHighlighted={highlightedCommentId === reply.id}
            hasReplies={repliedToIds.has(reply.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleReaction={onToggleReaction}
            onCreateSubIssue={onCreateSubIssue}
            onResolveToggle={onResolveToggle}
            onCopyLink={onCopyLink}
            onEditingChange={handleReplyEditing}
            onCollapseReply={forceShowReplies || replyFolded ? undefined : (trigger) => collapseReply(reply.id, trigger)}
            onExpandReply={() => expandReply(reply.id)}
            replyIsCollapsed={collapsed}
          />
        </div>
      )}
    </Fragment>
  );

  const replyCount = visibleReplies.length;
  const repliedToIds = new Set(allNestedReplies.map((reply) => reply.parent_id));
  const deleted = isDeletedComment(entry);
  const contentPreview = (entry.content ?? "").replace(/\n/g, " ").slice(0, 80);
  const reactions = entry.reactions ?? [];

  const isHighlighted = highlightedCommentId === entry.id;
  const toggleLabel = open ? t(($) => $.comment.collapse_thread) : t(($) => $.comment.expand_thread);

  // Reply-resolution display. When a REPLY is the thread's resolution, the other
  // replies fold behind a bar and the resolution stays visible (root-resolution
  // is handled one level up in issue-detail's resolved-bar, so kind "root" here
  // renders the normal full thread under the Collapse header).
  const resolution = deriveThreadResolution(entry, allNestedReplies);
  const replyResolutionId = resolution.kind === "reply" ? resolution.resolutionId : null;
  const threadExpanded = !!expandedResolvedIds?.has(entry.id);
  const replyFolded = replyResolutionId != null && !threadExpanded;
  const foldedReplies = replyResolutionId
    ? visibleReplies.filter((r) => r.id !== replyResolutionId)
    : visibleReplies;
  const resolutionReply = replyResolutionId
    ? allNestedReplies.find((r) => r.id === replyResolutionId) ?? null
    : null;
  // Replies and run slots in the order they happened (MUL-7628). Folded, the
  // resolution stays visible along with any run that has not replied yet.
  const threadRows = replyFolded
    ? orderThreadWithRuns(entry, resolutionReply ? [resolutionReply] : [], runs.filter((run) => !run.hasReply
      && (run.anchorCommentId === entry.id || run.anchorCommentId === replyResolutionId)))
    : orderThreadWithRuns(entry, allNestedReplies, runs);
  const latestReplyRow = [...threadRows].reverse().find((row) => {
    const reply = "run" in row ? row.reply : row;
    return reply && !isDeletedComment(reply);
  });
  const latestReplyId = latestReplyRow ? ("run" in latestReplyRow ? latestReplyRow.reply?.id : latestReplyRow.id) : undefined;
  useEffect(() => {
    if (requestedReplyId && (requestedReplyId !== latestReplyId || replyExpansionOverrides.get(`${olderRepliesKey}:${requestedReplyId}`) === false) && visibleReplies.some((reply) => reply.id === requestedReplyId)) {
      setReplyExpanded(requestedReplyId, true);
    }
  }, [requestedReplyId, latestReplyId, replies, setReplyExpanded, olderRepliesKey]);
  // Record active runs even when their reply row is outside the virtual window.
  for (const row of threadRows) {
    if ("run" in row && isActiveCommentRun(row.run.task) && (!row.reply || row.reply.id === latestReplyId || replyExpansionOverrides.get(`${olderRepliesKey}:${row.reply.id}`) === true)) {
      seenActiveRuns.current.add(row.run.task.id);
    }
  }
  const renderIndividualReply = (row: TimelineEntry | ThreadRunSlot) => {
    const reply = "run" in row ? row.reply : row;
    if (!reply || isDeletedComment(reply)) return renderThreadRow(row);
    const overridden = replyExpansionOverrides.get(`${olderRepliesKey}:${reply.id}`);
    const expanded = forceShowReplies || editingReplies.has(reply.id) || (overridden ?? (reply.id === latestReplyId || ("run" in row && seenActiveRuns.current.has(row.run.task.id))));
    return renderThreadRow(row, !expanded);
  };

  // Pin the root comment's header to the timeline's scroll parent while the
  // thread is open, so a LONG root comment keeps its author + actions visible
  // as you scroll its body (overflow-clip on the Card anchors this to the
  // timeline, not the card — see below). The root-section wrapper below scopes
  // its containing block to the header + body, so it releases the moment the
  // replies begin — exactly one header is pinned at a time. Each reply pins its
  // header the same way, scoped to its own row (see CommentRow). Skip the root
  // header whenever a resolution collapse bar already owns the top-0 sticky slot
  // (root resolved + expanded, or reply-resolution expanded): two sticky bars at
  // the same offset would stack and hide one.
  const stickyHeader =
    open && !onCollapseResolved && !(replyResolutionId != null && threadExpanded);

  return (
    // overflow-clip (not -hidden) clips the rounded corners WITHOUT creating a
    // scroll container, so the sticky collapse affordances below resolve to the
    // timeline's scroll parent instead of this card. See PR #3623.
    <Card ref={annotation.cardRef} {...annotation.captureProps} className={cn("!py-0 !gap-0 overflow-clip transition-colors duration-700", rootOnly && open && "rounded-b-none border-b-0")}>
      {annotation.popup}
      {onCollapseResolved && (
        <button
          type="button"
          onClick={() => { flushThreadEditors(); onCollapseResolved(); }}
          data-thread-sticky-bar
          className="sticky top-0 z-20 flex w-full items-center gap-2.5 border-b border-border/50 bg-muted px-4 max-md:px-3 py-2.5 text-left text-body text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground"
          aria-label={t(($) => $.comment.resolve.collapse)}
        >
          <ListChevronsDownUp className="h-3.5 w-3.5" />
          {t(($) => $.comment.resolve.collapse)}
        </button>
      )}
      {/* root-section — the sticky header's containing block. It wraps ONLY
            the header + root body, so the header releases the moment you scroll
            past the body into the replies (which render OUTSIDE this wrapper).
            That is what keeps exactly one header pinned at a time: without this
            wrapper the header's containing block is the whole thread and it
            stays stuck behind every reply. */}
        <div data-comment-block className={cn("transition-colors duration-700", isHighlighted && highlightedCommentBackgroundClass)}>
          {/* Keep the author aligned with replies; thread controls sit on the right. */}
          <StickyHeaderShell
            sticky={stickyHeader}
            highlighted={isHighlighted}
            className={cn("px-4 max-md:px-3", onCollapseReply ? "py-2" : !open ? "py-3" : stickyHeader ? "pt-3 pb-1" : "pt-3 pb-2")}
          >
            <div className="flex items-center gap-2.5">
              {onCollapseReply && <button type="button" disabled={edit.editing} onClick={(event) => onCollapseReply(event.currentTarget)}
                aria-expanded="true" aria-label={`${t(($) => $.comment.collapse_reply)}: ${entry.actor_name || getActorName(entry.actor_type, entry.actor_id)} ${replyPreview(entry)}`}
                className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"><ChevronRight aria-hidden className="h-4 w-4 rotate-90" /></button>}
              {deleted ? (
                // The thread's root was deleted; its replies still hang off it.
                <span className="min-w-0 truncate text-body italic text-muted-foreground">
                  {t(($) => $.comment.deleted_placeholder)}
                </span>
              ) : (
                <>
                  <ActorAvatar
                    actorType={entry.actor_type}
                    actorId={entry.actor_id}
                    name={entry.actor_name}
                    avatarUrl={entry.actor_avatar_url}
                    profileRequiresDirectoryEntry
                    size="md"
                    enableHoverCard
                    showStatusDot
                  />
                  <span className="shrink-0 cursor-pointer text-body font-medium">
                    {entry.actor_name || getActorName(entry.actor_type, entry.actor_id)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="shrink-0 text-label text-muted-foreground cursor-default">
                          {timeAgo(entry.created_at)}
                        </span>
                      }
                    />
                    <TooltipContent side="top">
                      {new Date(entry.created_at).toLocaleString(locale)}
                    </TooltipContent>
                  </Tooltip>

                  <SteerBadge issueId={issueId} entry={entry} />
                  {renderRuns(entry.id, "header")}
                  {entry.actor_type === "agent" && entry.source_task_id && (
                    <WakeupSourceChip issueId={issueId} taskId={entry.source_task_id} />
                  )}
                </>
              )}

              {!open && contentPreview && (
                <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
                  {contentPreview}
                </span>
              )}
              {!open && replyCount > 0 && (
                <span className="shrink-0 text-label text-muted-foreground">
                  {t(($) => $.comment.reply_count, { count: replyCount })}
                </span>
              )}

              <div data-comment-actions className="ml-auto flex shrink-0 items-center gap-0.5">
                <DeferredTooltip
                  content={toggleLabel}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={toggleLabel}
                      aria-expanded={open}
                      aria-controls={open ? `comment-body-${entry.id}` : undefined}
                      onClick={handleToggle}
                      className={commentActionClassName}
                    >
                      <ChevronRight aria-hidden className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                    </Button>
                  }
                />
                {open && !deleted && <>
                  {!edit.editing && <QuickEmojiPicker
                    onSelect={(emoji) => onToggleReaction(entry.id, emoji)}
                    ariaLabel={t(($) => $.comment.add_reaction)}
                    align="end"
                    className={buttonVariants({ variant: "ghost", size: "icon-sm", className: commentActionClassName })}
                  />}
                  <DropdownMenu>
                    <DeferredTooltip
                      content={t(($) => $.comment.more_actions)}
                      trigger={
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={commentActionClassName}
                              aria-label={t(($) => $.comment.more_actions)}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          }
                        />
                      }
                    />
                    <DropdownMenuContent align="end">
                      {/* Groups: act on it (edit, resolve), take it elsewhere, then delete alone. */}
                      {canEditEntry && (
                        <DropdownMenuItem onClick={edit.startEdit}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t(($) => $.comment.edit_action)}
                        </DropdownMenuItem>
                      )}
                      {onResolveToggle && (
                        <DropdownMenuItem onClick={() => onResolveToggle(entry.id, !entry.resolved_at)}>
                          {entry.resolved_at ? (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" />
                              {t(($) => $.comment.resolve.unresolve_thread_action)}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t(($) => $.comment.resolve.resolve_thread_action)}
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      {(canEditEntry || onResolveToggle) && <DropdownMenuSeparator />}
                      <DropdownMenuItem onClick={() => {
                        void copyText(entry.content ?? "").then((ok) => {
                          if (ok) toast.success(t(($) => $.comment.copied_toast));
                        });
                      }}>
                        <Copy className="h-3.5 w-3.5" />
                        {t(($) => $.comment.copy_action)}
                      </DropdownMenuItem>
                      {onCopyLink && (
                        <DropdownMenuItem onClick={() => onCopyLink(entry.id)}>
                          <Link2 className="h-3.5 w-3.5" />
                          {t(($) => $.comment.copy_link_action)}
                        </DropdownMenuItem>
                      )}
                      {onCreateSubIssue && entry.comment_type === "comment" && (
                        <DropdownMenuItem onClick={() => onCreateSubIssue(entry.id)}>
                          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                          {t(($) => $.source_context.create_action)}
                        </DropdownMenuItem>
                      )}
                      {canDeleteEntry && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete(true)} variant="destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                            {t(($) => $.comment.delete_action)}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DeleteCommentDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    onConfirm={() => onDelete(entry.id)}
                    hasReplies={replyCount > 0}
                  />
                </>}
              </div>
            </div>
          </StickyHeaderShell>

        {/* Root comment body. Avoid Base UI's Panel here: every mounted panel
            probes computed styles to detect animations, forcing a style
            recalculation across long issue-detail documents. */}
        {open && !deleted && (
          <div id={`comment-body-${entry.id}`} className="px-4 max-md:px-3 pb-3">
            {edit.editing ? (
              <div
                {...edit.dropZoneProps}
                className="relative pl-8 max-md:pl-0"
                onKeyDown={(e) => { if (e.key === "Escape") edit.cancelEdit(); }}
              >
                <div className="text-body leading-relaxed">
                  <ContentEditor
                    ref={edit.editorRef}
                    defaultValue={edit.initialValue}
                    placeholder={t(($) => $.comment.edit_placeholder)}
                    onUpdate={(md) => {
                      edit.setContent(md);
                      if (md.trim().length > 0) edit.setDraft(edit.draftKey, md);
                      else edit.clearDraft(edit.draftKey);
                    }}
                    onSubmit={edit.saveEdit}
                    onUploadFile={edit.handleUpload}
                    onUploadingChange={edit.onUploadingChange}
                    debounceMs={100}
                    currentIssueId={issueId}
                    attachments={edit.editorAttachments}
                  />
                </div>
                {edit.revisionConflict ? (
                  <CommentRevisionConflict
                    serverContent={entry.content ?? ""}
                    localContent={edit.content}
                    onKeepLocal={() => void edit.saveEdit()}
                    onUseServer={edit.adoptServerVersion}
                    saving={edit.saving}
                  />
                ) : null}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {edit.standaloneEditAttachments.length > 0 && (
                      <AttachmentList
                        attachments={edit.standaloneEditAttachments}
                        className="max-w-full"
                        onRemove={(attachmentId) =>
                          edit.setRetainedStandaloneIds((ids) => {
                            const next = new Set(ids ?? []);
                            next.delete(attachmentId);
                            return next;
                          })
                        }
                        />
                      )}
                    <CommentTriggerChips
                      recipients={edit.recipients}
                      blocked={edit.triggerPreview.blocked}
                      hasAllMembersMention={edit.triggerPreview.hasAllMembersMention}
                      draftContent={edit.content}
                      onActionChange={edit.setRecipientAction}
                    />
                    <FileUploadButton
                      size="sm"
                      multiple
                      onSelect={(file) => edit.editorRef.current?.uploadFile(file)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={edit.cancelEdit} disabled={edit.saving}>{t(($) => $.comment.cancel_edit)}</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={edit.saveEdit}
                      disabled={edit.saving || edit.uploading}
                      aria-disabled={edit.uploading || undefined}
                      aria-busy={edit.uploading || undefined}
                    >
                      {edit.saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {edit.uploading ? edit.uploadingLabel : t(($) => $.comment.save_action)}
                    </Button>
                  </div>
                </div>
                {edit.isDragOver && <FileDropOverlay />}
              </div>
            ) : !noticeRun && (
              <>
                <div tabIndex={currentUserId ? 0 : undefined} role="group"
            aria-label={t(($) => $.reply.annotations.source_label, { name: entry.actor_name || getActorName(entry.actor_type, entry.actor_id) })}
            data-comment-content={entry.id} className="pl-8 max-md:pl-0 text-body leading-relaxed text-foreground">
                  <ReadonlyContent content={entry.content ?? ""} attachments={entry.attachments} />
                </div>
                <AttachmentList attachments={entry.attachments} content={entry.content} className="mt-1.5 pl-8 max-md:pl-0" />
                <div className="pl-8 max-md:pl-0">
                  <SteerReceipts issueId={issueId} entry={entry} />
                </div>
                {retryableAgentFailureComment(entry) && (
                  <TaskCommentRetryButton
                    issueId={issueId}
                    taskId={entry.source_task_id}
                    className="mt-2 pl-8 max-md:pl-0"
                  />
                )}
              </>
            )}
            <div className="pl-8 max-md:pl-0">{renderRuns(entry.id)}</div>
            {!edit.editing && <ReactionBar
              reactions={reactions}
              showPicker={false}
              currentUserId={currentUserId}
              onToggle={(emoji) => onToggleReaction(entry.id, emoji)}
              getActorName={getActorName}
              className="mt-1.5 pl-8 max-md:pl-0"
            />}
          </div>
        )}
        </div>

        {/* Replies + reply input — rendered OUTSIDE root-section so the root
            header's sticky containing block ends with the body. Gated on `open`
            to mirror the body Panel's collapse visibility. */}
        {open && !rootOnly && (
          <>
          {replyFolded ? (
            <>
              {/* reply-mode folded: other replies behind a bar, resolution pinned below */}
              {foldedReplies.length > 0 && (
                <div className="border-t border-border/50 px-4 max-md:px-3 py-2.5">
                  <CommentsFoldBar
                    replies={foldedReplies}
                    onExpand={() => onResolvedExpandChange?.(entry.id, true)}
                  />
                </div>
              )}
              {threadRows.map((row) => renderThreadRow(row))}
            </>
          ) : (
            <>
              {/* reply-mode expanded: a Collapse affordance to fold back */}
              {replyResolutionId != null && onResolvedExpandChange && (
                <button
                  type="button"
                  onClick={() => { flushThreadEditors(); onResolvedExpandChange(entry.id, false); }}
                  data-thread-sticky-bar
                  className="sticky top-0 z-20 flex w-full items-center gap-2.5 border-t border-border/50 bg-muted px-4 max-md:px-3 py-2.5 text-left text-body text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  aria-label={t(($) => $.comment.resolve.collapse)}
                >
                  <ListChevronsDownUp className="h-3.5 w-3.5" />
                  {t(($) => $.comment.resolve.collapse)}
                </button>
              )}
              {threadRows.map(renderIndividualReply)}

              {/* Reply input */}
              <div className="border-t border-border/50 px-4 max-md:px-3 py-2.5">
                <ReplyInput
                  issueId={issueId}
                  parentId={replyTargetId}
                  targetMissing={replyTargetMissing}
                  placeholder={t(($) => $.reply.placeholder)}
                  size="sm"
                  avatarType="member"
                  avatarId={currentUserId ?? ""}
                  draftKey={`reply:${issueId}:${entry.id}`}
                  onEditAnnotation={(id) => annotation.editAnnotation(id, true)}
                  steerByDefault={steerThreadRunByDefault}
                  onSubmit={(content, attachmentIds, suppressAgentIds, steerTaskIds) => replyTargetMissing ? Promise.resolve(false) : onReply(replyTargetId, content, attachmentIds, suppressAgentIds, steerTaskIds)}
                  onAccepted={onReplyAccepted}
                />
              </div>
            </>
          )}
          </>
        )}
    </Card>
  );
}

// Memoized so a long timeline (e.g. Inbox-embedded IssueDetail with thousands
// of comments) does not re-render every card on each parent state update or
// WS-driven cache refresh. Default shallow comparison is sufficient: the
// timeline grouping is useMemo'd in issue-detail.tsx (stable Map ref), and
// every callback is stabilized via useCallback in use-issue-timeline.ts.
const CommentCard = memo(function CommentCard(props: CommentCardProps) {
  return <ActorDirectoryBoundary><CommentCardImpl {...props} /></ActorDirectoryBoundary>;
});

export { CommentCard, type CommentCardProps };
