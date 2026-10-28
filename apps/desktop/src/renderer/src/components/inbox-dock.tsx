import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InboxSurface, type InboxSurfaceController } from "@multica/views/inbox";
import { useT } from "@multica/views/i18n";
import { IconButton } from "@multica/ui/components/common/icon-button";
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
  headerAction,
}: {
  open: boolean;
  onToggle: () => void;
  headerAction: ReactNode;
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
      headerAction={headerAction}
    />
  );
}

export function DesktopInboxDockLayout({
  children,
  enabled,
  workspaceId,
}: DesktopInboxDockLayoutProps): ReactElement {
  const { t } = useT("inbox");
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
      dockPanelRef.current?.expand();
      dockPanelRef.current?.resize(`${inboxDockSizeRef.current}%`);
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
      if (nextOpen) setInboxDockSize(size.asPercentage);
      if (nextOpen !== inboxDockOpen) setInboxDockOpen(nextOpen);
    },
    [inboxDockOpen, setInboxDockOpen, setInboxDockSize],
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
    >
      <ResizablePanel id="content" defaultSize="62%" minSize="30%">
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
        id="inbox-dock"
        className="h-full !overflow-hidden"
        panelRef={dockPanelRef}
        defaultSize={initialDockSizeRef.current}
        minSize={260}
        maxSize="70%"
        collapsedSize={DOCK_COLLAPSED_SIZE}
        collapsible
        onResize={handleDockResize}
      >
        <DockInboxSurface
          key={workspaceId}
          open={inboxDockOpen}
          onToggle={() => setInboxDockOpen(!inboxDockOpen)}
          headerAction={headerAction}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
