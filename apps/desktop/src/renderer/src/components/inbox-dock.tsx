import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InboxSurface, type InboxSurfaceController } from "@multica/views/inbox";
import { useT } from "@multica/views/i18n";
import { IconButton } from "@multica/ui/components/common/icon-button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
  usePanelRef,
  type PanelSize,
} from "@multica/ui/components/ui/resizable";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

const DOCK_COLLAPSED_SIZE = 36;
type InboxView = InboxSurfaceController["view"];

interface DesktopInboxDockLayoutProps {
  children: ReactNode;
  enabled: boolean;
  workspaceId: string | null;
}

export function DesktopInboxDockLayout({
  children,
  enabled,
  workspaceId,
}: DesktopInboxDockLayoutProps): ReactElement {
  const { t } = useT("inbox");
  const inboxDockOpen = useDesktopPrefsStore((state) => state.inboxDockOpen);
  const setInboxDockOpen = useDesktopPrefsStore((state) => state.setInboxDockOpen);
  const [view, setViewState] = useState<InboxView>("inbox");
  const [selectedKey, setSelectedKey] = useState("");
  const dockPanelRef = usePanelRef();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_desktop_inbox_dock_layout",
  });

  const setView = useCallback((nextView: InboxView) => {
    setViewState(nextView);
    setSelectedKey("");
  }, []);

  const clearUnresolvedSelection = useCallback(() => {
    setSelectedKey("");
  }, []);

  useEffect(() => {
    setViewState("inbox");
    setSelectedKey("");
  }, [workspaceId]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    if (inboxDockOpen) dockPanelRef.current?.expand();
    else dockPanelRef.current?.collapse();
  }, [dockPanelRef, enabled, inboxDockOpen, workspaceId]);

  const handleDockResize = useCallback(
    (size: PanelSize, _id: string | number | undefined, previousSize: PanelSize | undefined) => {
      // react-resizable-panels reports a restored default layout on mount.
      // It is not a user resize and must not reopen a preference that was
      // deliberately persisted as collapsed.
      if (!previousSize) return;
      const nextOpen = size.inPixels > DOCK_COLLAPSED_SIZE;
      if (nextOpen !== inboxDockOpen) setInboxDockOpen(nextOpen);
    },
    [inboxDockOpen, setInboxDockOpen],
  );

  if (!enabled || !workspaceId) return <>{children}</>;

  const toggleLabel = inboxDockOpen
    ? t(($) => $.dock.collapse)
    : t(($) => $.dock.expand);
  const headerAction = (
    <IconButton
      label={toggleLabel}
      tooltipSide="top"
      onClick={() => setInboxDockOpen(!inboxDockOpen)}
    >
      {inboxDockOpen ? (
        <ChevronDown className="size-4" />
      ) : (
        <ChevronUp className="size-4" />
      )}
    </IconButton>
  );

  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="min-h-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel id="content" defaultSize="62%" minSize="30%">
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="inbox-dock"
        panelRef={dockPanelRef}
        defaultSize={inboxDockOpen ? "38%" : DOCK_COLLAPSED_SIZE}
        minSize={260}
        maxSize="70%"
        collapsedSize={DOCK_COLLAPSED_SIZE}
        collapsible
        onResize={handleDockResize}
      >
        <InboxSurface
          controller={{
            view,
            selectedKey,
            setView,
            setSelectedKey,
            onUnresolvedSelection: clearUnresolvedSelection,
          }}
          variant="dock"
          layoutId="multica_inbox_dock_content_layout"
          enableGlobalArchiveShortcut={false}
          contentInert={!inboxDockOpen}
          onDockHeaderToggle={() => setInboxDockOpen(!inboxDockOpen)}
          headerAction={headerAction}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
