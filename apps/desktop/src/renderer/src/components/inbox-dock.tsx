import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { InboxSurface, type InboxSurfaceController } from "@multica/views/inbox";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
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

function DockInboxSurface({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [view, setViewState] = useState<InboxView>("inbox");
  const [selectedKey, setSelectedKey] = useState("");

  const setView = useCallback((nextView: InboxView) => {
    setViewState(nextView);
    setSelectedKey("");
  }, []);

  const clearUnresolvedSelection = useCallback(() => {
    setSelectedKey("");
  }, []);

  return (
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
      contentInert={!open}
      onDockHeaderToggle={onToggle}
    />
  );
}

export function DesktopInboxDockLayout({
  children,
  enabled,
  workspaceId,
}: DesktopInboxDockLayoutProps): ReactElement {
  const inboxDockOpen = useDesktopPrefsStore((state) => state.inboxDockOpen);
  const inboxDockSize = useDesktopPrefsStore((state) => state.inboxDockSize);
  const setInboxDockOpen = useDesktopPrefsStore((state) => state.setInboxDockOpen);
  const setInboxDockSize = useDesktopPrefsStore((state) => state.setInboxDockSize);
  const dockPanelRef = usePanelRef();
  const initialDockSizeRef = useRef(`${inboxDockSize}%`);
  const inboxDockSizeRef = useRef(inboxDockSize);
  inboxDockSizeRef.current = inboxDockSize;

  useEffect(() => {
    if (!enabled || !workspaceId) return;
    if (inboxDockOpen) {
      if (dockPanelRef.current?.isCollapsed()) {
        dockPanelRef.current.expand();
        dockPanelRef.current.resize(`${inboxDockSizeRef.current}%`);
      }
    } else {
      dockPanelRef.current?.collapse();
    }
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

  const handleLayoutChanged = useCallback(() => {
    const size = dockPanelRef.current?.getSize();
    if (size && size.inPixels > DOCK_COLLAPSED_SIZE && useDesktopPrefsStore.getState().inboxDockOpen) {
      setInboxDockSize(size.asPercentage);
    }
  }, [dockPanelRef, setInboxDockSize]);

  if (!enabled || !workspaceId) return <>{children}</>;

  return (
    <ResizablePanelGroup
      orientation="vertical"
      className="min-h-0 flex-1 [&:has([data-separator=active])_*]:!cursor-row-resize [&:has([data-separator=active])]:!cursor-row-resize"
      onLayoutChanged={handleLayoutChanged}
    >
      <ResizablePanel id="content" defaultSize="62%" minSize="30%">
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </ResizablePanel>
      <ResizableHandle className="cursor-row-resize" />
      <ResizablePanel
        id="inbox-dock"
        className="h-full !overflow-hidden"
        panelRef={dockPanelRef}
        defaultSize={initialDockSizeRef.current}
        minSize={DOCK_COLLAPSED_SIZE}
        maxSize="70%"
        collapsedSize={DOCK_COLLAPSED_SIZE}
        collapsible
        onResize={handleDockResize}
      >
        <DockInboxSurface
          key={workspaceId}
          open={inboxDockOpen}
          onToggle={() => setInboxDockOpen(!inboxDockOpen)}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
