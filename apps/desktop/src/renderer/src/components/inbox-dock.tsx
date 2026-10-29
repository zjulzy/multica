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
  const motionEnabled = useDesktopPrefsStore((state) => state.interfaceMotionEnabled);
  const [animating, setAnimating] = useState(false);
  const [frozenInboxHeight, setFrozenInboxHeight] = useState<number | null>(null);
  const inboxContentRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopDockMotion = useCallback(() => {
    clearTimeout(animationTimer.current);
    animatingRef.current = false;
    setAnimating(false);
    setFrozenInboxHeight(null);
  }, []);
  useEffect(() => () => clearTimeout(animationTimer.current), []);
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
      if (!previousSize || animatingRef.current) return;
      const nextOpen = size.inPixels > DOCK_COLLAPSED_SIZE;
      if (nextOpen !== inboxDockOpen) setInboxDockOpen(nextOpen);
    },
    [inboxDockOpen, setInboxDockOpen],
  );

  const handleLayoutChanged = useCallback(() => {
    if (animatingRef.current) return;
    const size = dockPanelRef.current?.getSize();
    if (size && size.inPixels > DOCK_COLLAPSED_SIZE && useDesktopPrefsStore.getState().inboxDockOpen) {
      setInboxDockSize(size.asPercentage);
    }
  }, [dockPanelRef, setInboxDockSize]);

  if (!enabled || !workspaceId) return <>{children}</>;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div data-testid="dock-main-content" className="flex min-h-0 flex-1 flex-col">{children}</div>
    <div aria-hidden data-testid="dock-collapsed-spacer" className="h-9 shrink-0" />
    <ResizablePanelGroup
      orientation="vertical"
      data-dock-motion={animating && motionEnabled ? "on" : undefined}
      onPointerDownCapture={stopDockMotion}
      className="pointer-events-none absolute inset-0 z-10 min-h-0 [&:has([data-separator=active])_*]:!cursor-row-resize [&:has([data-separator=active])]:!cursor-row-resize"
      onLayoutChanged={handleLayoutChanged}
    >
      <ResizablePanel id="content" defaultSize="62%" minSize="30%" />
      <ResizableHandle className="pointer-events-auto cursor-row-resize" />
      <ResizablePanel
        id="inbox-dock"
        className="pointer-events-auto h-full !overflow-hidden bg-background"
        panelRef={dockPanelRef}
        defaultSize={initialDockSizeRef.current}
        minSize={DOCK_COLLAPSED_SIZE}
        maxSize="70%"
        collapsedSize={DOCK_COLLAPSED_SIZE}
        collapsible
        onResize={handleDockResize}
      >
        <div ref={inboxContentRef} data-testid="dock-inbox-content" className="h-full" style={frozenInboxHeight ? { height: frozenInboxHeight, flex: "none" } : undefined}>
        <DockInboxSurface
          key={workspaceId}
          open={inboxDockOpen}
          onToggle={() => {
            clearTimeout(animationTimer.current);
            if (motionEnabled) {
              const inboxHeight = inboxContentRef.current?.getBoundingClientRect().height ?? 0;
              const groupHeight = inboxContentRef.current?.closest('[data-slot="resizable-panel-group"]')?.getBoundingClientRect().height ?? 0;
              if (inboxHeight) setFrozenInboxHeight(Math.max(inboxHeight, groupHeight * inboxDockSizeRef.current / 100));
              animatingRef.current = true;
              setAnimating(true);
              animationTimer.current = setTimeout(stopDockMotion, 220);
            }
            setInboxDockOpen(!inboxDockOpen);
          }}
        />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
    </div>
  );
}
