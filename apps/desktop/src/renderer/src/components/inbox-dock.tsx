import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { InboxSurface, type InboxSurfaceController } from "@multica/views/inbox";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
  type PanelSize,
} from "@multica/ui/components/ui/resizable";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useT } from "@multica/views/i18n";
import { Bot } from "lucide-react";
import { AgentDock } from "./agent-dock";

const DOCK_COLLAPSED_SIZE = 36;
type InboxView = InboxSurfaceController["view"];

interface DesktopInboxDockLayoutProps {
  children: ReactNode;
  enabled: boolean;
  workspaceId: string | null;
  openRequest?: { workspaceId: string; key: string } | null;
  agentRequest?: { workspaceId: string; agentId: string } | null;
  onAgentRequestHandled?: (request: { workspaceId: string; agentId: string }) => void;
  onRequestHandled?: (request: { workspaceId: string; key: string }) => void;
  onTemporaryClose?: () => void;
}

function DockInboxSurface({
  open,
  onToggle,
  workspaceId,
  openRequest,
  onRequestHandled,
  dockTabAction,
  dockContentVisible,
  dockContentReplacement,
}: {
  open: boolean;
  onToggle: () => void;
  workspaceId: string;
  openRequest?: { workspaceId: string; key: string } | null;
  onRequestHandled?: (request: { workspaceId: string; key: string }) => void;
  dockTabAction?: ReactNode;
  dockContentVisible: boolean;
  dockContentReplacement?: ReactNode;
}) {
  const [view, setViewState] = useState<InboxView>("inbox");
  const [selectedKey, setSelectedKeyState] = useState("");
  const [pinnedSelectionKey, setPinnedSelectionKey] = useState<string | null>(null);
  const [handledRequest, setHandledRequest] = useState<typeof openRequest>(null);
  const pendingRequest = openRequest && openRequest.workspaceId === workspaceId && openRequest !== handledRequest ? openRequest : null;

  useEffect(() => {
    if (!pendingRequest) return;
    setViewState("inbox");
    setSelectedKeyState(pendingRequest.key);
    setPinnedSelectionKey(pendingRequest.key);
    setHandledRequest(pendingRequest);
    onRequestHandled?.(pendingRequest);
  }, [pendingRequest, onRequestHandled]);

  const setSelectedKey = useCallback((key: string) => {
    setSelectedKeyState(key);
    setPinnedSelectionKey((previous) => previous === key ? previous : null);
  }, []);

  const setView = useCallback((nextView: InboxView) => {
    setViewState(nextView);
    setSelectedKey("");
  }, [setSelectedKey]);

  const clearUnresolvedSelection = useCallback(() => {
    setSelectedKey("");
  }, [setSelectedKey]);

  return (
    <InboxSurface
      controller={{
        view: pendingRequest ? "inbox" : view,
        selectedKey: pendingRequest?.key ?? selectedKey,
        setView,
        setSelectedKey,
        onUnresolvedSelection: clearUnresolvedSelection,
      }}
      variant="dock"
      pinnedSelectionKey={pendingRequest?.key ?? pinnedSelectionKey}
      layoutId="multica_inbox_dock_content_layout"
      enableGlobalArchiveShortcut={false}
      contentInert={!open}
      onDockHeaderToggle={onToggle}
      dockTabAction={dockTabAction}
      dockContentVisible={dockContentVisible}
      dockContentReplacement={dockContentReplacement}
    />
  );
}

export function DesktopInboxDockLayout({
  children,
  enabled,
  workspaceId,
  openRequest,
  onRequestHandled,
  agentRequest,
  onAgentRequestHandled,
  onTemporaryClose,
}: DesktopInboxDockLayoutProps): ReactElement {
  const persistedDockOpen = useDesktopPrefsStore((state) => state.inboxDockOpen);
  const { t } = useT("agents");
  const [activeTab, setActiveTab] = useState<"inbox" | "agents">("inbox");
  const [selectedAgent, setSelectedAgent] = useState<{ agentId: string } | null>(null);
  const effectiveTab = agentRequest?.workspaceId === workspaceId ? "agents" : openRequest?.workspaceId === workspaceId ? "inbox" : activeTab;
  useEffect(() => { setSelectedAgent(null); }, [workspaceId]);
  useEffect(() => {
    if (agentRequest && agentRequest.workspaceId === workspaceId) {
      setActiveTab("agents");
      setSelectedAgent({ agentId: agentRequest.agentId });
      onAgentRequestHandled?.(agentRequest);
    }
  }, [agentRequest, workspaceId, onAgentRequestHandled]);
  useEffect(() => { if (openRequest && openRequest.workspaceId === workspaceId) setActiveTab("inbox"); }, [openRequest, workspaceId]);
  const inboxDockOpen = onTemporaryClose ? true : persistedDockOpen;
  const inboxDockSize = useDesktopPrefsStore((state) => state.inboxDockSize);
  const setInboxDockOpen = useDesktopPrefsStore((state) => state.setInboxDockOpen);
  const setInboxDockSize = useDesktopPrefsStore((state) => state.setInboxDockSize);
  const motionEnabled = useDesktopPrefsStore((state) => state.interfaceMotionEnabled);
  const [animating, setAnimating] = useState(false);
  const [motionPhase, setMotionPhase] = useState<"opening" | "closing" | null>(null);
  const [motionStart, setMotionStart] = useState<string | null>(null);
  const [frozenInboxHeight, setFrozenInboxHeight] = useState<number | null>(null);
  const inboxContentRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const userResizingRef = useRef(false);
  const resizeGestureRef = useRef<{ kind: "pointer"; id: number } | { kind: "keyboard"; key: string } | null>(null);
  const lastPointerIdRef = useRef<number | null>(null);
  const resizeEndTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopDockMotion = useCallback(() => {
    clearTimeout(animationTimer.current);
    animatingRef.current = false;
    setAnimating(false);
    setMotionPhase(null);
    setMotionStart(null);
    setFrozenInboxHeight(null);
  }, []);
  useEffect(() => {
    const finishResize = () => {
      clearTimeout(resizeEndTimer.current);
      resizeEndTimer.current = setTimeout(() => { userResizingRef.current = false; resizeGestureRef.current = null; }, 100);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (resizeGestureRef.current?.kind === "pointer" && resizeGestureRef.current.id === event.pointerId) finishResize();
    };
    const keyEnd = (event: KeyboardEvent) => {
      if (resizeGestureRef.current?.kind === "keyboard" && resizeGestureRef.current.key === event.key) finishResize();
    };
    const blur = () => { clearTimeout(resizeEndTimer.current); userResizingRef.current = false; resizeGestureRef.current = null; };
    window.addEventListener("pointerup", pointerEnd);
    window.addEventListener("pointercancel", pointerEnd);
    window.addEventListener("keyup", keyEnd);
    window.addEventListener("blur", blur);
    return () => {
      clearTimeout(animationTimer.current);
      clearTimeout(resizeEndTimer.current);
      window.removeEventListener("pointerup", pointerEnd);
      window.removeEventListener("pointercancel", pointerEnd);
      window.removeEventListener("keyup", keyEnd);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const beginUserResize = useCallback((gesture: { kind: "pointer"; id: number } | { kind: "keyboard"; key: string }) => {
    clearTimeout(resizeEndTimer.current);
    userResizingRef.current = true;
    resizeGestureRef.current = gesture;
    stopDockMotion();
  }, [stopDockMotion]);
  useEffect(() => {
    if (!enabled || !workspaceId) return;
    const handle = resizeHandleRef.current;
    if (!handle) return;
    const onPointerDown = (event: PointerEvent) => { if (event.button === 0) lastPointerIdRef.current = event.pointerId; };
    const observer = new MutationObserver(() => {
      if (handle.getAttribute("data-separator") === "active" && lastPointerIdRef.current !== null) beginUserResize({ kind: "pointer", id: lastPointerIdRef.current });
    });
    document.addEventListener("pointerdown", onPointerDown, true);
    observer.observe(handle, { attributes: true, attributeFilter: ["data-separator"] });
    return () => { observer.disconnect(); document.removeEventListener("pointerdown", onPointerDown, true); };
  }, [enabled, workspaceId, beginUserResize]);
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
      if (!previousSize || animatingRef.current || !userResizingRef.current) return;
      const nextOpen = size.inPixels > DOCK_COLLAPSED_SIZE + 0.5;
      if (nextOpen !== inboxDockOpen) {
        if (!nextOpen && onTemporaryClose) onTemporaryClose();
        else setInboxDockOpen(nextOpen);
      }
    },
    [inboxDockOpen, onTemporaryClose, setInboxDockOpen],
  );

  const handleLayoutChanged = useCallback(() => {
    if (animatingRef.current) return;
    const size = dockPanelRef.current?.getSize();
    if (size && userResizingRef.current) {
      const nextOpen = size.inPixels > DOCK_COLLAPSED_SIZE + 0.5;
      if (nextOpen !== inboxDockOpen) {
        if (!nextOpen && onTemporaryClose) onTemporaryClose();
        else setInboxDockOpen(nextOpen);
      }
    }
    if (size && size.inPixels > DOCK_COLLAPSED_SIZE && useDesktopPrefsStore.getState().inboxDockOpen) {
      setInboxDockSize(size.asPercentage);
    }
  }, [dockPanelRef, inboxDockOpen, onTemporaryClose, setInboxDockOpen, setInboxDockSize]);

  const toggleDock = () => {
    userResizingRef.current = false;
    resizeGestureRef.current = null;
    clearTimeout(resizeEndTimer.current);
    clearTimeout(animationTimer.current);
    if (motionEnabled && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const currentTransform = animatingRef.current && inboxContentRef.current
        ? window.getComputedStyle(inboxContentRef.current).transform
        : "";
      setMotionStart(currentTransform && currentTransform !== "none" ? currentTransform : null);
      const inboxHeight = inboxContentRef.current?.getBoundingClientRect().height ?? 0;
      const groupHeight = inboxContentRef.current?.closest('[data-slot="resizable-panel-group"]')?.getBoundingClientRect().height ?? 0;
      if (inboxHeight) setFrozenInboxHeight(Math.max(inboxHeight, groupHeight * inboxDockSizeRef.current / 100));
      animatingRef.current = true;
      setMotionPhase(inboxDockOpen ? "closing" : "opening");
      setAnimating(true);
      animationTimer.current = setTimeout(stopDockMotion, 220);
    } else {
      stopDockMotion();
    }
    if (inboxDockOpen && onTemporaryClose) onTemporaryClose();
    else setInboxDockOpen(!inboxDockOpen);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div data-testid="dock-main-content" className="flex min-h-0 flex-1 flex-col">{children}</div>
    {enabled && workspaceId && <>
    <div aria-hidden data-testid="dock-collapsed-spacer" className="h-9 shrink-0" />
    <ResizablePanelGroup
      orientation="vertical"
      data-dock-motion={animating && motionEnabled ? "on" : undefined}
      className="pointer-events-none absolute inset-0 z-10 min-h-0 [&:has([data-separator=active])_*]:!cursor-row-resize [&:has([data-separator=active])]:!cursor-row-resize"
      onLayoutChanged={handleLayoutChanged}
    >
      <ResizablePanel id="content" defaultSize="62%" minSize="30%" />
      <ResizableHandle elementRef={resizeHandleRef} className="pointer-events-auto cursor-row-resize" onPointerDownCapture={(event) => { if (event.button === 0) beginUserResize({ kind: "pointer", id: event.pointerId }); }} onKeyDownCapture={(event) => {
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) beginUserResize({ kind: "keyboard", key: event.key });
      }} />
      <ResizablePanel
        id="inbox-dock"
        className={animating && frozenInboxHeight ? "pointer-events-auto h-full !overflow-visible bg-transparent" : "pointer-events-auto h-full !overflow-hidden bg-background"}
        panelRef={dockPanelRef}
        defaultSize={initialDockSizeRef.current}
        minSize={DOCK_COLLAPSED_SIZE}
        maxSize="70%"
        collapsedSize={DOCK_COLLAPSED_SIZE}
        collapsible
        onResize={handleDockResize}
      >
        <div ref={inboxContentRef} data-testid="dock-inbox-content" data-dock-motion-phase={frozenInboxHeight ? motionPhase ?? undefined : undefined} className="relative h-full bg-background" style={frozenInboxHeight ? { height: frozenInboxHeight, flex: "none", contain: "layout paint", position: "absolute", bottom: 0, left: 0, right: 0, ...(motionStart ? { "--dock-motion-start": motionStart } : {}) } as CSSProperties : undefined}>
        <DockInboxSurface
          key={workspaceId}
          workspaceId={workspaceId}
          openRequest={openRequest}
          onRequestHandled={onRequestHandled}
          open={inboxDockOpen && effectiveTab === "inbox"}
          dockContentVisible={effectiveTab === "inbox"}
          dockContentReplacement={(inboxDockOpen || animating) && effectiveTab === "agents" ? <div inert={!inboxDockOpen || undefined} aria-hidden={!inboxDockOpen || undefined} className="min-h-0 flex-1 bg-background"><AgentDock key={workspaceId} workspaceId={workspaceId} requestedAgent={agentRequest?.workspaceId === workspaceId ? agentRequest : selectedAgent} /></div> : null}
          dockTabAction={<button type="button" aria-expanded={inboxDockOpen && effectiveTab === "agents"} onClick={() => {
            if (inboxDockOpen && effectiveTab === "agents") {
              toggleDock();
            } else { setActiveTab("agents"); if (!inboxDockOpen) toggleDock(); }
          }} className={`inline-flex h-7 shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 text-left text-muted-foreground shadow-sm outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${inboxDockOpen && effectiveTab === "agents" ? "border-primary/30 bg-accent text-foreground" : ""}`}><Bot aria-hidden className="size-4" /><span className="text-body font-semibold">{t(($) => $.dock.title)}</span></button>}
          onToggle={() => {
            if (inboxDockOpen && effectiveTab === "agents") { setActiveTab("inbox"); return; }
            toggleDock();
          }}
        />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
    </>}
    </div>
  );
}
