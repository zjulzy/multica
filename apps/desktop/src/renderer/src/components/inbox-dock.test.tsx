import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const panelApi = vi.hoisted(() => ({
  collapse: vi.fn(),
  expand: vi.fn(),
  isCollapsed: vi.fn(() => false),
}));

vi.mock("react-resizable-panels", () => ({
  useDefaultLayout: () => ({
    defaultLayout: { content: 62, "inbox-dock": 38 },
    onLayoutChanged: vi.fn(),
  }),
  usePanelRef: () => ({ current: panelApi }),
}));

vi.mock("@multica/ui/components/ui/resizable", () => ({
  ResizablePanelGroup: ({
    children,
    orientation,
  }: {
    children: ReactNode;
    orientation: string;
  }) => (
    <div data-testid="dock-layout" data-orientation={orientation}>
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
  }: {
    children: ReactNode;
    id: string;
    defaultSize?: number | string;
    minSize?: number | string;
    maxSize?: number | string;
    collapsedSize?: number | string;
    collapsible?: boolean;
    onResize?: (size: { inPixels: number; asPercentage: number }) => void;
  }) => (
    <section
      data-testid={`panel-${id}`}
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
      data-collapsed-size={collapsedSize}
      data-collapsible={collapsible}
    >
      {id === "inbox-dock" && onResize && (
        <button
          type="button"
          onClick={() => onResize({ inPixels: 36, asPercentage: 5 })}
        >
          Simulate drag collapse
        </button>
      )}
      {children}
    </section>
  ),
  ResizableHandle: () => <div data-testid="dock-resize-handle" />,
}));

vi.mock("@multica/views/inbox", () => ({
  InboxSurface: ({
    controller,
    variant,
    layoutId,
    enableGlobalArchiveShortcut,
    contentInert,
    headerAction,
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
    headerAction: ReactNode;
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
      {headerAction}
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
    });
    panelApi.collapse.mockClear();
    panelApi.expand.mockClear();
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
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute("data-collapsed-size", "36");
    expect(screen.getByTestId("panel-inbox-dock")).toHaveAttribute("data-default-size", "36");
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-content-inert", "true");
    expect(panelApi.collapse).toHaveBeenCalled();
  });

  it("expands from the local header action and persists the open state", () => {
    renderDock();

    fireEvent.click(screen.getByRole("button", { name: "Expand Inbox" }));

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(true);
    expect(panelApi.expand).toHaveBeenCalled();
    expect(screen.getByTestId("inbox-surface")).toHaveAttribute("data-content-inert", "false");
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
});
