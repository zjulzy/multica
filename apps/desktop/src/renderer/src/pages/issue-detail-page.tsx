import { useParams } from "react-router-dom";
import { IssueDetailRoute } from "@multica/views/issues/components";
import { useWorkspaceId } from "@multica/core/hooks";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { usePinnedIssueEligibility } from "@/components/use-pinned-issue-eligibility";

export function IssueDetailPage({ onDelete, onDone, onInitialContentReady, inboxPresentation }: { onDelete?: () => void; onDone?: () => void; onInitialContentReady?: () => void; inboxPresentation?: { surface: "page" | "dock"; highlightCommentId?: string; highlightRequestToken?: number } }) {
  const { id } = useParams<{ id: string }>();
  const wsId = useWorkspaceId();
  // `id` may be an identifier (`MUL-123`); resolving here means the title
  // watches the same UUID-keyed entry realtime events patch. Shares its
  // queries with the IssueDetailRoute below, so it costs no extra request.
  const { issue, canonicalId } = useCanonicalIssue(wsId, id ?? "");
  const cached = usePinnedIssueEligibility(wsId, canonicalId, !onDelete);

  useDocumentTitle(issue ? `${issue.identifier}: ${issue.title}` : "Issue");

  if (!id) return null;
  // Render errors bubble to the root route errorElement (DesktopRouteErrorPage),
  // which contains the crash inside the tab content pane. No page-level boundary
  // here — a whole-page wrapper duplicates the route-level error UI.
  return <IssueDetailRoute routeId={id} onDelete={onDelete} onDone={onDone} suppressDetail={cached} onInitialContentReady={onInitialContentReady}
    highlightCommentId={inboxPresentation?.highlightCommentId} highlightRequestToken={inboxPresentation?.highlightRequestToken}
    defaultSidebarOpen={inboxPresentation ? false : undefined} layoutId={inboxPresentation ? `multica_inbox_${inboxPresentation.surface}_issue_detail_layout` : undefined}
    leadingAction={inboxPresentation ? false : undefined} />;
}
