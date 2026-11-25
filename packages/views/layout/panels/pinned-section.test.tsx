import type { ReactNode } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@multica/core/api";
import { buildIssueStatusCatalog } from "@multica/core/issue-statuses/queries";
import type { PinnedItem } from "@multica/core/types";
import { useSidebarTreeStore } from "@multica/core/issues/stores/sidebar-tree-store";
import { renderWithI18n } from "../../test/i18n";
import { IssueContextMenuProvider } from "../../issues/actions";
import { PinnedSection, usePanelPins } from "./pinned-section";
import { PersistentPinsProvider } from "../persistent-pins-context";
import { pinnedViewScope, usePinnedSidebarViews } from "@multica/core/issue-views/pinned-sidebar-views";

vi.mock("@multica/core/api", async (original) => ({ ...(await original<typeof import("@multica/core/api")>()), api: { getBaseUrl: () => "https://test.example" } }));
vi.mock("../../issue-views/builtin-views", async (original) => ({ ...(await original<typeof import("../../issue-views/builtin-views")>()), useBuiltinViewNavigation: () => ({ hrefFor: () => "/acme/issues", prepare: vi.fn() }) }));

vi.mock("../../issues/actions/issue-actions-menu-items", () => ({
  contextPrimitives: {},
  IssueActionsMenuItems: ({ issue, variant }: { issue: { title: string }; variant?: string }) => (
    <div>{`${variant} menu: ${issue.title}`}</div>
  ),
}));
vi.mock("../../issues/actions/use-issue-actions", () => ({ useIssueActions: () => ({}) }));

const state = vi.hoisted(() => ({
  pins: [] as PinnedItem[],
  detail: { isPending: false, isError: false, data: null as unknown, error: null as unknown },
  project: { isPending: false, isError: false, data: null as unknown, error: null as unknown },
  views: [] as Array<{ id: string; name: string; scope_type: string; scope_id: string | null }>,
  deletePin: vi.fn(),
}));

vi.mock("@multica/core/issue-statuses/hooks", () => ({
  useIssueStatuses: () => buildIssueStatusCatalog([]),
}));
vi.mock("../../navigation", () => ({
  useNavigation: () => ({ pathname: "/acme/issues", searchParams: new URLSearchParams() }),
  AppLink: ({ children, href, ...props }: { children: ReactNode; href: string } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../../issues/components/status-icon", () => ({ StatusIcon: () => <span /> }));
vi.mock("@multica/ui/components/common/tooltip-hint", () => ({
  TooltipHint: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@multica/core/paths", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@multica/core/paths")>();
  return { ...actual, useWorkspacePaths: () => actual.paths.workspace("acme") };
});
vi.mock("@multica/core/pins/queries", () => ({ pinListOptions: () => ({ queryKey: ["pins"] }) }));
vi.mock("@multica/core/pins/mutations", () => ({
  useDeletePin: () => ({ mutate: state.deletePin }),
  useReorderPins: () => ({ mutate: vi.fn() }),
}));
vi.mock("@multica/core/issues/queries", () => ({ issueDetailOptions: () => ({ queryKey: ["issue"] }) }));
vi.mock("@multica/core/projects/queries", () => ({ projectDetailOptions: () => ({ queryKey: ["project"] }) }));
vi.mock("@multica/core/issue-views/queries", () => ({
  issueViewDetailOptions: () => ({ queryKey: ["view"] }),
  issueViewEverywhereOptions: () => ({ queryKey: ["views"] }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "pins") return { data: state.pins };
    if (queryKey[0] === "issue") return state.detail;
    if (queryKey[0] === "project") return state.project;
    if (queryKey[0] === "views") return { isPending: false, isError: false, data: state.views };
    return { isPending: true, isError: false, data: undefined, error: null };
  },
}));

const pin = (n: number): PinnedItem => ({
  id: `pin-${n}`,
  workspace_id: "ws-1",
  user_id: "user-1",
  item_type: "issue",
  item_id: `issue-${n}`,
  position: n,
  created_at: "2026-05-06T00:00:00Z",
});

let activePinnedRoute = false;
function Harness({ pathname, currentIssueId = null }: { pathname: string; currentIssueId?: string | null }) {
  const pins = usePanelPins("ws-1", "user-1", pathname, currentIssueId);
  activePinnedRoute = pins.isActivePinnedRoute;
  return (
    <IssueContextMenuProvider variant="sidebar">
      <PinnedSection pins={pins} wsId="ws-1" />
    </IssueContextMenuProvider>
  );
}

beforeEach(() => {
  state.pins = [pin(1)];
  state.detail = { isPending: false, isError: false, data: null, error: null };
  state.project = { isPending: false, isError: false, data: null, error: null };
  state.deletePin.mockReset();
  state.views = [];
  usePinnedSidebarViews.setState({ byScope: {}, orderByScope: {} });
  activePinnedRoute = false;
  useSidebarTreeStore.setState({ pinnedCollapsed: false });
});

describe("PinnedSection", () => {
  it("shows pinned builtin and saved views alongside issues and can unpin them", () => {
    const scope = pinnedViewScope("https://test.example", "ws-1", "user-1");
    usePinnedSidebarViews.getState().pin(scope, "builtin:all_issues");
    usePinnedSidebarViews.getState().pin(scope, "view:saved-1");
    state.views = [{ id: "saved-1", name: "My saved view", scope_type: "workspace", scope_id: null }];
    state.detail = { isPending: false, isError: false, data: { identifier: "MUL-1", title: "Pinned issue", status: "todo" }, error: null };
    renderWithI18n(<PersistentPinsProvider><Harness pathname="/acme/issues" /></PersistentPinsProvider>);
    expect(screen.getByRole("link", { name: "My saved view" })).toHaveAttribute("href", "/acme/issues?view=saved-1");
    expect(screen.getByRole("link", { name: "All issues" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Unpin" })[2]!);
    expect(screen.queryByRole("link", { name: "My saved view" })).toBeNull();
  });
  it.each([
    ["MUL-123 修复加载问题", "修复加载问题", "MUL-123 修复加载问题"],
    ["mul-123：修复加载问题", "修复加载问题", "mul-123：修复加载问题"],
    ["MUL-1234 是另一个编号", "MUL-1234 是另一个编号", "MUL-123 · MUL-1234 是另一个编号"],
    ["MUL-123", "MUL-123", "MUL-123"],
    ["7141782723 外部缺陷编号", "7141782723 外部缺陷编号", "MUL-123 · 7141782723 外部缺陷编号"],
    ["【CL507334】【多人不同步】从远处来队友领地", "【多人不同步】从远处来队友领地", "MUL-123 · 【CL507334】【多人不同步】从远处来队友领地"],
    ["[BUG-7170483147] 【CL521401】【相机】玩家在滑索上", "【相机】玩家在滑索上", "MUL-123 · [BUG-7170483147] 【CL521401】【相机】玩家在滑索上"],
    ["[STORY-7148266388] 【战斗】滑索二期", "【战斗】滑索二期", "MUL-123 · [STORY-7148266388] 【战斗】滑索二期"],
    ["[STORY-7148266388]", "[STORY-7148266388]", "MUL-123 · [STORY-7148266388]"],
    ["[BUG-7170483147] 【CL521401】", "[BUG-7170483147] 【CL521401】", "MUL-123 · [BUG-7170483147] 【CL521401】"],
    ["【cl442360】【交互表现】出现两个按钮", "【交互表现】出现两个按钮", "MUL-123 · 【cl442360】【交互表现】出现两个按钮"],
    ["【CL507334】", "【CL507334】", "MUL-123 · 【CL507334】"],
    ["【CLIENT问题】连接失败", "【CLIENT问题】连接失败", "MUL-123 · 【CLIENT问题】连接失败"],
  ])("only hides this issue's own prefix in the pinned label", (title, expected, tooltip) => {
    state.detail = { isPending: false, isError: false, data: { identifier: "MUL-123", title, status: "todo" }, error: null };
    renderWithI18n(<PersistentPinsProvider><Harness pathname="/acme/issues" /></PersistentPinsProvider>);
    const link = screen.getByRole("link", { name: expected });
    expect(link).toHaveAttribute("title", tooltip);
  });
  it.each([["🚀"], [null]])("shows a pinned project's icon with a fallback", (icon) => {
    state.pins = [{ ...pin(1), item_type: "project", item_id: "project-1" }];
    state.project = { isPending: false, isError: false, data: { title: "Project", icon }, error: null };
    renderWithI18n(<Harness pathname="/acme/projects" />);
    const iconSlot = screen.getByRole("link", { name: "Project" }).previousElementSibling;
    if (icon) expect(iconSlot).toHaveTextContent(icon);
    else expect(iconSlot?.matches("svg")).toBe(true);
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/acme/projects/project-1");
  });
  it("shows every pin and the active state even if an old collapsed setting exists", () => {
    state.pins = Array.from({ length: 6 }, (_, i) => pin(i + 1));
    state.detail = { isPending: false, isError: false, data: { identifier: "MUL-1", title: "Pinned issue", status: "todo" }, error: null };
    useSidebarTreeStore.setState({ pinnedCollapsed: true });
    renderWithI18n(<PersistentPinsProvider><Harness pathname="/acme/issues/MUL-6" currentIssueId="issue-6" /></PersistentPinsProvider>);
    expect(document.querySelector('a[href="/acme/issues/issue-6"]')).toHaveAttribute("aria-current", "page");
    expect(activePinnedRoute).toBe(true);
    expect(screen.queryByRole("button", { name: "Pinned" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show 1 more…" })).not.toBeInTheDocument();
  });
  it("unpins items whose detail is gone", async () => {
    state.detail = { isPending: false, isError: true, data: null, error: new ApiError("missing", 404, "Not Found") };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    await waitFor(() => expect(state.deletePin).toHaveBeenCalledTimes(1));
  });

  it("keeps pins through other errors", async () => {
    state.detail = { isPending: false, isError: true, data: null, error: new ApiError("error", 500, "Server Error") };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    await waitFor(() => expect(state.deletePin).not.toHaveBeenCalled());
  });

  it("renders a loaded issue by its title and marks it active on its page", async () => {
    state.detail = {
      isPending: false,
      isError: false,
      data: { identifier: "MUL-123", title: "Keep this pin", status: "todo" },
      error: null,
    };
    // The issue route rewrites the pin's UUID URL to the identifier form.
    renderWithI18n(<Harness pathname="/acme/issues/MUL-123" currentIssueId="issue-1" />);
    const row = (await screen.findByText("Keep this pin")).closest("a");
    expect(row).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("MUL-123 Keep this pin")).toBeNull();
    expect(activePinnedRoute).toBe(true);
  });

  it("opens the sidebar issue menu when a pinned issue is right-clicked", async () => {
    state.detail = {
      isPending: false,
      isError: false,
      data: { identifier: "MUL-123", title: "Keep this pin", status: "todo" },
      error: null,
    };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    const row = (await screen.findByText("Keep this pin")).closest("a")!.parentElement!;
    fireEvent.contextMenu(row);

    expect(await screen.findByText("sidebar menu: Keep this pin")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-popup-open");
  });

  it("previews five pins and only counts a hidden pin as active once expanded", () => {
    state.pins = Array.from({ length: 6 }, (_, i) => pin(i + 1));
    state.detail = {
      isPending: false,
      isError: false,
      data: { identifier: "MUL-1", title: "Pinned issue", status: "todo" },
      error: null,
    };
    renderWithI18n(<Harness pathname="/acme/issues/MUL-6" currentIssueId="issue-6" />);
    const lastPin = () => document.querySelector('a[href="/acme/issues/issue-6"]');

    expect(lastPin()).toBeNull();
    expect(activePinnedRoute).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Show 1 more…" }));
    expect(lastPin()).toHaveAttribute("aria-current", "page");
    expect(activePinnedRoute).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(lastPin()).toBeNull();
  });

  it("collapses from the section label and stops claiming the active route", async () => {
    state.detail = {
      isPending: false,
      isError: false,
      data: { identifier: "MUL-123", title: "Keep this pin", status: "todo" },
      error: null,
    };
    renderWithI18n(<Harness pathname="/acme/issues/MUL-123" currentIssueId="issue-1" />);
    await screen.findByText("Keep this pin");
    expect(activePinnedRoute).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Pinned" }));
    expect(useSidebarTreeStore.getState().pinnedCollapsed).toBe(true);
    expect(screen.queryByText("Keep this pin")).toBeNull();
    expect(screen.getByRole("button", { name: "Pinned" })).toHaveAttribute("aria-expanded", "false");
    expect(activePinnedRoute).toBe(false);
  });

  it("shows a pinned project's chosen icon, keeping the folder when it has none", async () => {
    state.pins = [{ ...pin(1), item_type: "project", item_id: "project-1" }];
    state.project = { isPending: false, isError: false, data: { title: "Rocket launch", icon: "🚀" }, error: null };
    const { unmount } = renderWithI18n(<Harness pathname="/acme/issues" />);
    const iconSlot = async () => (await screen.findByText("Rocket launch")).closest("a")!.previousElementSibling;
    expect(await iconSlot()).toHaveTextContent("🚀");
    expect((await iconSlot())?.matches("svg")).toBe(false);
    unmount();

    state.project = { isPending: false, isError: false, data: { title: "Rocket launch", icon: null }, error: null };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    expect(await iconSlot()).not.toHaveTextContent("🚀");
    expect((await iconSlot())?.matches("svg")).toBe(true);
  });

  it("marks a pinned private project with a lock", async () => {
    state.pins = [{ ...pin(1), item_type: "project", item_id: "project-1" }];
    state.project = { isPending: false, isError: false, data: { title: "Fundraise", icon: null, visibility: "private" }, error: null };
    const { unmount } = renderWithI18n(<Harness pathname="/acme/issues" />);
    const lock = await screen.findByRole("img", { name: "Visible to project members only" });
    expect(lock.closest("a")).toHaveTextContent("Fundraise");
    unmount();

    state.project = { isPending: false, isError: false, data: { title: "Fundraise", icon: null, visibility: "workspace" }, error: null };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    await screen.findByText("Fundraise");
    expect(screen.queryByRole("img", { name: "Visible to project members only" })).toBeNull();
  });

  // dnd-kit stops the release's click at the document without cancelling
  // it. Where React listens below the document (Desktop), it never sees that
  // click, so the row must not wait for it before opening on the next one.
  it("does not open the pin released at the end of a drag, and opens it on the next click", async () => {
    state.detail = {
      isPending: false,
      isError: false,
      data: { identifier: "MUL-123", title: "Keep this pin", status: "todo" },
      error: null,
    };
    renderWithI18n(<Harness pathname="/acme/issues" />);
    const row = (await screen.findByText("Keep this pin")).closest("a")!;
    const pointer = { isPrimary: true, button: 0, clientX: 30, clientY: 100 };
    fireEvent.pointerDown(row, pointer);
    fireEvent.pointerMove(document, { ...pointer, clientY: 110 });
    fireEvent.pointerUp(document, { ...pointer, clientY: 110 });

    expect(fireEvent.click(row)).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(fireEvent.click(row)).toBe(true);
  });

  it("renders nothing without pins", () => {
    state.pins = [];
    const { container } = renderWithI18n(<Harness pathname="/acme/issues" />);
    expect(container).toBeEmptyDOMElement();
  });
});
