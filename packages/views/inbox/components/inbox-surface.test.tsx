import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem } from "@multica/core/types";
import type { InboxView } from "./inbox-view";
import { InboxSurface, type InboxSurfaceController } from "./inbox-surface";

const state = vi.hoisted(() => ({
  items: [] as InboxItem[],
  replace: vi.fn(),
  archive: vi.fn(),
  markRead: vi.fn(),
  clearFilters: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-resizable-panels", () => ({
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChanged: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn() }),
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: options.queryKey.includes("lookup")
      ? { items: [], hasMore: false, nextCursor: null }
      : state.items,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useInfiniteQuery: () => ({
    data: { pages: [{ items: [], hasMore: false, nextCursor: null }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock("@multica/core/hooks", () => ({ useWorkspaceId: () => "workspace-1" }));
vi.mock("@multica/core/paths", () => ({
  useWorkspacePaths: () => ({ inbox: () => "/acme/inbox", issueDetail: (id: string) => `/acme/issues/${id}` }),
}));
vi.mock("@multica/core/modals", () => ({
  useModalStore: { getState: () => ({ modal: null, open: vi.fn() }) },
}));
vi.mock("@multica/core/issues/stores/draft-store", () => ({
  useIssueDraftStore: { getState: () => ({ setManual: vi.fn() }) },
}));

vi.mock("@multica/core/inbox/queries", () => ({
  inboxListOptions: () => ({ queryKey: ["inbox", "workspace-1", "list"] }),
  archivedInboxPagesOptions: () => ({ queryKey: ["inbox", "workspace-1", "archived"] }),
  archivedInboxLookupOptions: () => ({ queryKey: ["inbox", "workspace-1", "lookup"] }),
  deduplicateInboxItems: (items: InboxItem[]) => items,
  deduplicateArchivedInboxItems: (items: InboxItem[]) => items,
  useInboxUnreadCount: () => 2,
}));

vi.mock("@multica/core/inbox/mutations", () => {
  const mutation = () => ({ mutate: vi.fn() });
  return {
    useMarkInboxRead: () => ({ mutate: state.markRead }),
    useMarkInboxUnread: mutation,
    useArchiveInbox: () => ({ mutate: state.archive }),
    useUnarchiveInbox: mutation,
    useMarkAllInboxRead: mutation,
    useArchiveAllInbox: mutation,
    useArchiveAllReadInbox: mutation,
    useArchiveCompletedInbox: mutation,
    useRetrySourceContextQuickCreate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock("@multica/core/inbox/filter-store", () => ({
  filterInboxItems: (items: InboxItem[]) => items,
  inboxFiltersForArchive: (filters: unknown) => filters,
  inboxFiltersForPrioritySupport: (filters: unknown) => filters,
  inboxFilterCount: () => 0,
  inboxPriorityFilterSupport: () => "supported",
  useInboxFilters: () => ({
    unreadOnly: false,
    idleOnly: false,
    statuses: [],
    priorities: [],
    actorIds: [],
  }),
  useInboxFilterStore: (selector: (value: { clearFilters: typeof state.clearFilters }) => unknown) =>
    selector({ clearFilters: state.clearFilters }),
}));

vi.mock("../../issues/components/issue-detail", () => ({
  IssueDetail: ({ enableGlobalFindShortcut }: { enableGlobalFindShortcut?: boolean }) => (
    <div data-testid="issue-detail" data-global-find={enableGlobalFindShortcut}>Issue detail</div>
  ),
  issueHighlightMementoKey: (id: string) => `highlight:${id}`,
}));
vi.mock("../../issues/components/issue-peek", () => ({
  IssuePeekHost: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../issues/surface/activity", () => ({
  useIssueSurfaceActivity: () => ({ activityByIssueId: new Map() }),
}));
vi.mock("../../platform", () => ({ useViewStateWriter: () => vi.fn() }));
vi.mock("../../navigation", () => ({
  useNavigation: () => ({ searchParams: new URLSearchParams(), replace: state.replace }),
  useReportNavigating: () => {},
}));
vi.mock("../../layout/page-header", () => ({
  PAGE_GUTTER: "",
  PageHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="page-header">{children}</div>
  ),
}));
vi.mock("../../modals/use-issue-limit-upgrade-prompt", () => ({
  useIssueLimitUpgradePrompt: () => vi.fn(),
}));
vi.mock("../../i18n", () => ({ useT: () => ({ t: () => "Inbox" }) }));

vi.mock("@multica/ui/hooks/use-mobile", () => ({ useIsCompact: () => false }));
vi.mock("@multica/ui/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => null,
}));

vi.mock("./inbox-list", () => ({
  InboxList: ({ items, onSelect }: { items: InboxItem[]; onSelect: (item: InboxItem) => void }) => (
    <div>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelect(item)}>
          {item.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./inbox-filter-menu", () => ({ InboxFilterMenu: () => <button>Filter</button> }));
vi.mock("./inbox-context-menu", () => ({
  InboxContextMenuProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./inbox-list-item", () => ({ useTimeAgo: () => () => "now" }));
vi.mock("./inbox-detail-label", () => ({ useTypeLabels: () => ({}) }));
vi.mock("./autopilot-quota-notice", () => ({ AutopilotQuotaNotice: () => null }));

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "inbox-1",
    workspace_id: "workspace-1",
    recipient_type: "member",
    recipient_id: "member-1",
    actor_type: "agent",
    actor_id: "agent-1",
    type: "new_comment",
    severity: "info",
    issue_id: "issue-1",
    title: "Issue title",
    body: null,
    issue_status: null,
    issue_priority: null,
    read: true,
    archived: false,
    created_at: "2026-06-15T08:00:00Z",
    details: null,
    ...overrides,
  };
}

function controller(overrides: Partial<InboxSurfaceController> = {}): InboxSurfaceController {
  return {
    view: "inbox" as InboxView,
    selectedKey: "",
    setView: vi.fn(),
    setSelectedKey: vi.fn(),
    onUnresolvedSelection: vi.fn(),
    ...overrides,
  };
}

function renderDock(
  value: InboxSurfaceController,
  onDockHeaderToggle: () => void = vi.fn(),
  contentInert = false,
) {
  return render(
    <InboxSurface
      controller={value}
      variant="dock"
      layoutId="test-dock-layout"
      enableGlobalArchiveShortcut={false}
      contentInert={contentInert}
      onDockHeaderToggle={onDockHeaderToggle}
      headerAction={<button type="button">Dock action</button>}
    />,
  );
}

describe("InboxSurface dock controller", () => {
  beforeEach(() => {
    state.items = [];
    state.replace.mockClear();
    state.archive.mockClear();
    state.markRead.mockClear();
  });

  it("selects through the supplied controller without calling navigation", () => {
    state.items = [item()];
    const value = controller();

    renderDock(value);
    fireEvent.click(screen.getByRole("button", { name: "Issue title" }));

    expect(value.setSelectedKey).toHaveBeenCalledWith("issue-1");
    expect(state.replace).not.toHaveBeenCalled();
  });

  it("reports an unresolved dock selection through the controller", () => {
    const value = controller({ selectedKey: "missing-issue" });

    renderDock(value);

    expect(value.onUnresolvedSelection).toHaveBeenCalledWith("missing-issue");
    expect(state.replace).not.toHaveBeenCalled();
  });

  it("renders dock chrome locally instead of mounting PageHeader", () => {
    renderDock(controller());

    expect(screen.getByText("Dock action")).toBeInTheDocument();
    expect(screen.queryByTestId("page-header")).not.toBeInTheDocument();
  });

  it("toggles from the dock title without treating header controls as toggles", () => {
    const onDockHeaderToggle = vi.fn();
    renderDock(controller(), onDockHeaderToggle);

    fireEvent.click(screen.getByRole("heading", { name: "Inbox" }));
    expect(onDockHeaderToggle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    expect(onDockHeaderToggle).toHaveBeenCalledTimes(1);
  });

  it("does not register the global archive shortcut when disabled", () => {
    state.items = [item()];
    renderDock(controller({ selectedKey: "issue-1" }));

    fireEvent.keyDown(document, { key: "e" });

    expect(state.archive).not.toHaveBeenCalled();
  });

  it("does not let the page archive shortcut act on a key event from the dock", () => {
    state.items = [item()];
    render(
      <>
        <InboxSurface
          controller={controller({ selectedKey: "issue-1" })}
          variant="page"
          layoutId="page-layout"
          enableGlobalArchiveShortcut
        />
        <InboxSurface
          controller={controller({ selectedKey: "issue-1" })}
          variant="dock"
          layoutId="dock-layout"
          enableGlobalArchiveShortcut={false}
        />
      </>,
    );

    const dock = document.querySelector('[data-inbox-surface="dock"]');
    expect(dock).not.toBeNull();

    fireEvent.keyDown(document.body, { key: "e" });
    expect(state.archive).toHaveBeenCalledTimes(1);
    state.archive.mockClear();

    fireEvent.keyDown(dock!, { key: "e" });

    expect(state.archive).not.toHaveBeenCalled();
  });

  it("keeps collapsed content full-height but inert without marking unread work as read", () => {
    state.items = [item({ read: false })];

    const value = controller({ selectedKey: "issue-1" });
    const { rerender } = renderDock(value, vi.fn(), true);

    const dock = document.querySelector('[data-inbox-surface="dock"]');
    expect(dock).toHaveClass("h-full");
    expect(state.markRead).not.toHaveBeenCalled();
    expect(screen.getByTestId("issue-detail")).toHaveAttribute("data-global-find", "false");

    rerender(
      <InboxSurface
        controller={value}
        variant="dock"
        layoutId="test-dock-layout"
        enableGlobalArchiveShortcut={false}
        contentInert={false}
      />,
    );
    expect(state.markRead).toHaveBeenCalledWith("inbox-1", expect.anything());
    expect(screen.getByTestId("issue-detail")).toHaveAttribute("data-global-find", "true");
  });
});
