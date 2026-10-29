import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const panelApi = vi.hoisted(() => ({
  collapse: vi.fn(),
  expand: vi.fn(),
  resize: vi.fn(),
  getSize: vi.fn(() => ({ inPixels: 300, asPercentage: 38 })),
  isCollapsed: vi.fn(() => true),
}));

vi.mock("@multica/ui/components/ui/resizable", () => ({
  useDefaultLayout: () => ({
    defaultLayout: { content: 62, "inbox-dock": 38 },
    onLayoutChanged: vi.fn(),
  }),
  usePanelRef: () => ({ current: panelApi }),
  ResizablePanelGroup: ({
    children,
    orientation,
    onLayoutChanged,
    "data-dock-motion": dockMotion,
    onPointerDownCapture,
  }: {
    children: ReactNode;
    orientation: string;
    onLayoutChanged?: (layout: Record<string, number>) => void;
    "data-dock-motion"?: string;
    onPointerDownCapture?: () => void;
  }) => (
    <div data-testid="dock-layout" data-orientation={orientation} data-dock-motion={dockMotion} onPointerDownCapture={onPointerDownCapture}>
      <button type="button" onClick={() => onLayoutChanged?.({ content: 40, "inbox-dock": 60 })}>Finish drag</button>
      {children}
    </div>
  ),
  ResizablePanel: ({
    children,
    id,
    defaultSize,
    minSize,
    maxSize,
    collapsedSize,
    collapsible,
    onResize,
    className,
  }: {
    children: ReactNode;
    id: string;
    defaultSize?: number | string;
    minSize?: number | string;
    maxSize?: number | string;
    collapsedSize?: number | string;
    collapsible?: boolean;
    onResize?: (
      size: { inPixels: number; asPercentage: number },
      id: string,
      previousSize?: { inPixels: number; asPercentage: number },
    ) => void;
    className?: string;
  }) => (
    <section
      data-testid={`panel-${id}`}
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
      data-collapsed-size={collapsedSize}
      data-collapsible={collapsible}
      data-class-name={className}
    >
      {id === "inbox-dock" && onResize && (
        <>
          <button
            type="button"
            onClick={() =>
              onResize(
                { inPixels: 36, asPercentage: 5 },
                id,
                { inPixels: 300, asPercentage: 38 },
              )
            }
          >
            Simulate drag collapse
          </button>
          <button
            type="button"
            onClick={() => onResize({ inPixels: 300, asPercentage: 38 }, id)}
          >
            Simulate initial restored layout
          </button>
          <button
            type="button"
            onClick={() =>
              onResize(
                { inPixels: 480, asPercentage: 60 },
                id,
                { inPixels: 300, asPercentage: 38 },
              )
            }
          >
            Simulate drag expanded
          </button>
        </>
      )}
      {children}
    </section>
  ),
  ResizableHandle: ({ className }: { className?: string }) => <div data-testid="dock-resize-handle" className={className} />,
}));

vi.mock("@multica/views/inbox", () => ({
  InboxSurface: ({
    controller,
    variant,
    layoutId,
    enableGlobalArchiveShortcut,
    contentInert,
    onDockHeaderToggle,
  }: {
    controller: {
      view: string;
      selectedKey: string;
      setView: (view: "archived") => void;
      setSelectedKey: (key: string) => void;
    };
    variant: string;
    layoutId: string;
    enableGlobalArchiveShortcut: boolean;
    contentInert: boolean;
    onDockHeaderToggle: () => void;
  }) => (
    <div
      data-testid="inbox-surface"
      data-view={controller.view}
      data-selected-key={controller.selectedKey}
      data-variant={variant}
      data-layout-id={layoutId}
      data-global-shortcut={enableGlobalArchiveShortcut}
      data-content-inert={contentInert}
    >
      <button type="button" onClick={onDockHeaderToggle}>
        {contentInert ? "Expand Inbox" : "Collapse Inbox"}
      </button>
      <button type="button" onClick={() => controller.setView("archived")}>
        Show archive
      </button>
      <button type="button" onClick={() => controller.setSelectedKey("issue-9")}>
        Select issue
      </button>
    </div>
  ),
}));

const translations = {
  dock: { expand: "Expand Inbox", collapse: "Collapse Inbox" },
};

vi.mock("@multica/views/i18n", () => ({
  useT: () => ({
    t: (selector: (resources: typeof translations) => string) => selector(translations),
  }),
}));

import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { DesktopInboxDockLayout } from "./inbox-dock";

function renderDock({
  enabled = true,
  workspaceId = "workspace-1",
}: {
  enabled?: boolean;
  workspaceId?: string | null;
} = {}) {
  return render(
    <DesktopInboxDockLayout enabled={enabled} workspaceId={workspaceId}>
      <main>Main content</main>
    </DesktopInboxDockLayout>,
  );
}

describe("DesktopInboxDockLayout", () => {
  beforeEach(() => {
    useDesktopPrefsStore.setState({
      singleTabMode: false,
      inboxDockEnabled: false,
      inboxDockOpen: false,
      inboxDockSize: 38,
      interfaceMotionEnabled: false,
    });
    panelApi.collapse.mockClear();
    panelApi.expand.mockClear();
    panelApi.resize.mockClear();
    panelApi.isCollapsed.mockReturnValue(true);
    panelApi.getSize.mockReturnValue({ inPixels: 300, asPercentage: 38 });
  });

  it.each([
    ["disabled", false, "workspace-1"],
    ["without a workspace", true, null],
  ])("returns the main content without a resizable group when %s", (_label, enabled, workspaceId) => {
    renderDock({ enabled, workspaceId });

    expect(screen.getByText("Main content")).toBeInTheDocument();
    expect(screen.queryByTestId("dock-layout")).not.toBeInTheDocument();
  });

  it("starts enabled in a 36px collapsed state while keeping Inbox mounted", () => {
    renderDock();

    expect(screen.getByTestId("dock-layout")).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByTestId("dock-resize-handle")).toHaveClass("cursor-row-resize");
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute("data-collapsed-size", "36");
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute("data-min-size", "36");
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute("data-default-size", "38%");
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute(
      "data-class-name",
      expect.stringContaining("!overflow-hidden"),
    );
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-content-inert", "true");
    expect(panelApi.collapse).toHaveBeenCalled();
  });

  it("expands from the local header action and persists the open state", () => {
    renderDock();

    fireEvent.click(screen.getByRole("button", { name: "Expand Inbox" }));

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
    expect(panelApi.expand).toHaveBeenCalled();
    expect(panelApi.resize).toHaveBeenCalledWith("38%");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-content-inert", "false");
  });

  it("enables dock motion only for a header toggle and stops it when a drag starts", () => {
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: true });
    renderDock();
    const group = screen.getByTestId("dock-layout");
    expect(group).not.toHaveAttribute("data-dock-motion", "on");
    fireEvent.click(screen.getByRole("button", { name: "Expand Inbox" }));
    expect(group).toHaveAttribute("data-dock-motion", "on");
    fireEvent.pointerDown(screen.getByTestId("dock-resize-handle"));
    expect(group).not.toHaveAttribute("data-dock-motion", "on");
  });

  it("ignores intermediate resize reports during a click animation", () => {
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: true, inboxDockOpen: true });
    renderDock();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Inbox" }));
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Simulate drag expanded" }));
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    fireEvent.pointerDown(screen.getByTestId("dock-resize-handle"));
    fireEvent.click(screen.getByRole("button", { name: "Simulate drag expanded" }));
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
  });

  it("keeps the main page outside the resizable overlay and releases the Inbox for dragging", () => {
    useDesktopPrefsStore.setState({ interfaceMotionEnabled: true, inboxDockOpen: true });
    renderDock();
    const content = screen.getByTestId("dock-main-content");
    const inbox = screen.getByTestId("dock-inbox-content");
    expect(screen.getByTestId("dock-layout")).not.toContainElement(content);
    expect(screen.getByTestId("dock-collapsed-spacer")).toHaveClass("h-9");
    vi.spyOn(inbox, "getBoundingClientRect").mockReturnValue({ height: 220 } as DOMRect);
    fireEvent.click(screen.getByRole("button", { name: "Collapse Inbox" }));
    expect(content.style.height).toBe("");
    expect(inbox.style.height).toBe("220px");
    fireEvent.pointerDown(screen.getByTestId("dock-resize-handle"));
    expect(content.style.height).toBe("");
    expect(inbox.style.height).toBe("");
  });

  it("passes an isolated dock surface configuration while expanded", () => {
    useDesktopPrefsStore.setState({ inboxDockOpen: true });
    renderDock();

    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-variant", "dock");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute(
      "data-layout-id",
      "multica_inbox_dock_content_layout",
    );
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-global-shortcut", "false");
    expect(screen.getByRole("button", { name: "Collapse Inbox" })).toBeInTheDocument();
  });

  it("keeps open state but resets local view and selection when the workspace changes", () => {
    useDesktopPrefsStore.setState({ inboxDockOpen: true });
    const { rerender } = renderDock();
    fireEvent.click(screen.getByRole("button", { name: "Show archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Select issue" }));
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-view", "archived");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-selected-key", "issue-9");

    rerender(
      <DesktopInboxDockLayout enabled workspaceId="workspace-2">
        <main>Main content</main>
      </DesktopInboxDockLayout>,
    );

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-view", "inbox");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-selected-key", "");
  });

  it("stores a drag-to-collapse transition", () => {
    useDesktopPrefsStore.setState({ inboxDockOpen: true });
    renderDock();

    fireEvent.click(screen.getByRole("button", { name: "Simulate drag collapse" }));

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
  });

  it("does not reapply a stored height while a collapsed panel is being dragged open", () => {
    renderDock();
    panelApi.isCollapsed.mockReturnValue(false);
    panelApi.resize.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Simulate drag expanded" }));

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
    expect(panelApi.resize).not.toHaveBeenCalled();
  });

  it("ignores an initial restored layout callback while the dock preference is closed", () => {
    renderDock();

    fireEvent.click(screen.getByRole("button", { name: "Simulate initial restored layout" }));

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    expect(useDesktopPrefsStore.getState().inboxDockSize).toBe(38);
  });

  it("restores the last expanded height after collapsing", () => {
    useDesktopPrefsStore.setState({ inboxDockOpen: true });
    renderDock();

    fireEvent.click(screen.getByRole("button", { name: "Simulate drag expanded" }));
    expect(useDesktopPrefsStore.getState().inboxDockSize).toBe(38);
    panelApi.getSize.mockReturnValue({ inPixels: 480, asPercentage: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Finish drag" }));
    expect(useDesktopPrefsStore.getState().inboxDockSize).toBe(60);

    fireEvent.click(screen.getByRole("button", { name: "Simulate drag collapse" }));
    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    expect(useDesktopPrefsStore.getState().inboxDockSize).toBe(60);

    fireEvent.click(screen.getByRole("button", { name: "Expand Inbox" }));
    expect(panelApi.resize).toHaveBeenLastCalledWith("60%");
  });

  it("discards transient Inbox state when the feature is disabled", () => {
    const { rerender } = renderDock();
    fireEvent.click(screen.getByRole("button", { name: "Show archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Select issue" }));

    rerender(
      <DesktopInboxDockLayout enabled={false} workspaceId="workspace-1">
        <main>Main content</main>
      </DesktopInboxDockLayout>,
    );
    rerender(
      <DesktopInboxDockLayout enabled workspaceId="workspace-1">
        <main>Main content</main>
      </DesktopInboxDockLayout>,
    );

    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-view", "inbox");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-selected-key", "");
  });
});
