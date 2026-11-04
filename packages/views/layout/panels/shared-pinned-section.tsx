"use client";

import { useAuthStore } from "@multica/core/auth";
import { useCurrentWorkspace } from "@multica/core/paths";
import { useNavigation } from "../../navigation";
import { IssueContextMenuProvider } from "../../issues/actions";
import { PinnedSection, usePanelPins } from "./pinned-section";

/** Reuses the workspace's existing pin data and actions across navigation spaces. */
export function SharedPinnedSection({ compactSheet = false }: { compactSheet?: boolean }) {
  const wsId = useCurrentWorkspace()?.id;
  const userId = useAuthStore((s) => s.user?.id);
  const { pathname } = useNavigation();
  const pins = usePanelPins(wsId, userId, pathname, null);
  if (!wsId || pins.visible.length === 0) return null;
  const section = (
    <IssueContextMenuProvider variant="sidebar">
      <div data-pinned-section>
        <PinnedSection pins={pins} wsId={wsId} />
      </div>
    </IssueContextMenuProvider>
  );
  return compactSheet ? (
    <div className="my-2 mr-2 w-[260px] min-w-0 overflow-y-auto rounded-xl bg-page-canvas px-2 pb-3 shadow-[var(--surface-shadow)] ring-1 ring-surface-border">
      {section}
    </div>
  ) : section;
}
