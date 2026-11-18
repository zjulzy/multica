"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Bot, CircleUser, Folder, Layers, X } from "@multica/ui/icons";
import { cn } from "@multica/ui/lib/utils";
import { TooltipHint } from "@multica/ui/components/common/tooltip-hint";
import { ShimmerText } from "@multica/ui/components/common/shimmer-text";
import { api, ApiError } from "@multica/core/api";
import { pinnedViewScope, usePinnedSidebarViews } from "@multica/core/issue-views/pinned-sidebar-views";
import { issueViewEverywhereOptions } from "@multica/core/issue-views/queries";
import { issueViewTarget } from "@multica/core/issue-views/view-target";
import { BUILTIN_VIEW_KEYS, type BuiltinViewKey } from "@multica/core/issue-views/sidebar-views";
import { BUILTIN_VIEW_ICON, useBuiltinViewLabel, useBuiltinViewNavigation } from "../../issue-views/builtin-views";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { issueDetailOptions } from "@multica/core/issues/queries";
import { projectDetailOptions } from "@multica/core/projects/queries";
import { pinListOptions } from "@multica/core/pins/queries";
import { useSidebarTreeStore } from "@multica/core/issues/stores/sidebar-tree-store";
import { useDeletePin, useReorderPins } from "@multica/core/pins/mutations";
import { useIssueUnread } from "@multica/core/issues/unread";
import { isMyAgentsSearch, useWorkspacePaths, type WorkspacePaths } from "@multica/core/paths";
import { issueViewContainerKey, useActiveIssueViewStore } from "@multica/core/issue-views/active-view-store";
import type { Issue, PinnedItem } from "@multica/core/types";
import { AppLink, useNavigation } from "../../navigation";
import { IssueActionsContextMenu } from "../../issues/actions";
import { useStatusLabel } from "../../issues/utils/status-label";
import { ProjectIcon } from "../../projects/components/project-icon";
import { useT } from "../../i18n";
import { PANEL_ROW_CLASS, PanelList, PanelSection, isPathWithin, panelRowAnchor, panelRowStateClass } from "../panel-nav";
import { usePersistentPins } from "../persistent-pins-context";
import { useDragClickGuard } from "../use-drag-click-guard";
import { PinnedSectionSettings, SECTION_SETTINGS_REVEAL_CLASS } from "./sidebar-settings";
import {
  ISSUE_ROW_LINK_CLASS,
  IssueAgentBadge,
  IssueUnreadDot,
  PrivateProjectLock,
  SIDEBAR_SHIMMER_CLASS,
  SidebarIssueStatus,
  issueRowMenuOpenClass,
  unreadIssueHref,
  useIssueAgentState,
} from "./sidebar-tree";

// Stable empty default: an inline `= []` on useQuery is a new reference every
// render while the query is disabled, which re-fires the sync effect below.
const EMPTY_PINS: PinnedItem[] = [];
const EMPTY_VIEW_IDS: string[] = [];

function pinHref(p: WorkspacePaths, pin: PinnedItem): string {
  return pin.item_type === "issue" ? p.issueDetail(pin.item_id) : pin.item_type === "view" ? p.issues() : p.projectDetail(pin.item_id);
}

/**
 * Pin list state for the Issues panel. Lifted out of the section so the
 * panel can keep its plain rows unlit while a pinned item is the page on
 * screen.
 *
 * An issue pin matches by id, not by path: the issue route rewrites its UUID
 * URL to the `MUL-123` form, which a pin's href never equals.
 */
export function usePanelPins(
  wsId: string | undefined,
  userId: string | undefined,
  pathname: string,
  currentIssueId: string | null,
) {
  const p = useWorkspacePaths();
  const persistentPins = usePersistentPins();
  const { data: allPins = EMPTY_PINS } = useQuery({
    ...pinListOptions(wsId ?? "", userId ?? ""),
    enabled: !!wsId && !!userId,
  });
  const scope = pinnedViewScope(api.getBaseUrl(), wsId ?? "", userId ?? "");
  const pinnedViews = usePinnedSidebarViews((state) => state.byScope[scope] ?? EMPTY_VIEW_IDS);
  const customOrder = usePinnedSidebarViews((state) => state.orderByScope?.[scope] ?? EMPTY_VIEW_IDS);
  const { searchParams } = useNavigation();
  const activeViews = useActiveIssueViewStore((state) => state.active);
  const { data: allViews } = useQuery({ ...issueViewEverywhereOptions(wsId ?? ""), enabled: !!wsId && pinnedViews.some((id) => id.startsWith("view:")) });
  const pinnedItems = useMemo(() => {
    const base = allPins.filter((pin) => pin.item_type !== "view");
    const local: PinnedItem[] = pinnedViews.map((id) => ({ id: `local-view:${id}`, workspace_id: wsId ?? "", user_id: userId ?? "", item_type: "view", item_id: id, position: 0, created_at: "" }));
    const combined = [...base, ...local];
    if (!customOrder.length) return combined;
    const order = new Map(customOrder.map((id, index) => [id, index]));
    return combined.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  }, [allPins, pinnedViews, customOrder, wsId, userId]);
  const viewPins = useMemo(() => allPins.filter((pin) => pin.item_type === "view"), [allPins]);

  // Local presentational copy for drop-animation stability. Follows the query
  // at rest; frozen during a drag so a mid-drag cache write (our own
  // optimistic update, or a WS refetch) cannot reorder the DOM under dnd-kit
  // while its drop animation is still interpolating.
  const [localPinned, setLocalPinned] = useState<PinnedItem[]>(pinnedItems);
  const [localPinnedWsId, setLocalPinnedWsId] = useState<string | null>(wsId ?? null);
  const [expandedWsId, setExpandedWsId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    if (!isDraggingRef.current) setLocalPinned(pinnedItems);
  }, [pinnedItems]);
  useEffect(() => {
    setLocalPinnedWsId(wsId ?? null);
  }, [wsId]);

  const visible = localPinnedWsId === (wsId ?? null) ? localPinned : EMPTY_PINS;
  const expanded = expandedWsId === (wsId ?? null);
  const limit = useSidebarTreeStore((s) => s.pinnedLimit);
  const displayed = persistentPins || expanded ? visible : visible.slice(0, limit);
  const isPinActive = (pin: PinnedItem) => {
    if (pin.item_type === "issue") return pin.item_id === currentIssueId;
    if (pin.item_type !== "view") return isPathWithin(pathname, pinHref(p, pin));
    if (pin.item_id.startsWith("builtin:")) {
      const key = pin.item_id.slice(8);
      if (key === "my_issues" || key === "my_agents") return pathname === p.myIssues() && (key === "my_agents") === isMyAgentsSearch(searchParams);
      if (!BUILTIN_VIEW_KEYS.includes(key as BuiltinViewKey)) return false;
      const container = issueViewContainerKey(wsId ?? "", { scope_type: "workspace" });
      return pathname === p.issues() && (activeViews[container] ?? null) === (key === "all_issues" ? null : key);
    }
    const view = allViews?.find((item) => `view:${item.id}` === pin.item_id);
    if (!view) return false;
    const target = issueViewTarget(wsId ?? "", view, p);
    return pathname === target.path && activeViews[target.containerKey] === view.id;
  };
  // A collapsed section shows no rows, so it must not keep the tree unlit.
  const pinnedCollapsed = useSidebarTreeStore((s) => s.pinnedCollapsed);
  const isActivePinnedRoute = (persistentPins || !pinnedCollapsed) && displayed.some(isPinActive);

  return {
    visible,
    displayed,
    expanded,
    limit,
    isActivePinnedRoute,
    isPinActive,
    setExpanded: (next: boolean) => setExpandedWsId(next ? wsId ?? null : null),
    setLocalPinned,
    isDraggingRef,
    viewPins,
    scope,
  };
}

type PanelPins = ReturnType<typeof usePanelPins>;

export function PinnedSection({ pins, wsId }: { pins: PanelPins; wsId: string }) {
  const { t } = useT("layout");
  const persistentPins = usePersistentPins();
  const p = useWorkspacePaths();
  const deletePin = useDeletePin();
  const reorderPins = useReorderPins();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { visible, displayed, expanded, limit, setExpanded, setLocalPinned, isDraggingRef, viewPins, isPinActive, scope } = pins;
  const unpinView = usePinnedSidebarViews((s) => s.unpin);
  const reorderAll = usePinnedSidebarViews((s) => s.reorderAll);
  const collapsed = useSidebarTreeStore((s) => s.pinnedCollapsed);
  const setCollapsed = useSidebarTreeStore((s) => s.setPinnedCollapsed);
  const { arm: armClickGuard, release: releaseClickGuard } = useDragClickGuard();

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    armClickGuard();
  }, [armClickGuard, isDraggingRef]);
  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    releaseClickGuard();
  }, [isDraggingRef, releaseClickGuard]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      releaseClickGuard();
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = visible.findIndex((pin) => pin.id === active.id);
      const newIndex = visible.findIndex((pin) => pin.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(visible, oldIndex, newIndex);
      setLocalPinned(reordered);
      reorderAll(scope, reordered.map((pin) => pin.id));
      reorderPins.mutate([...reordered.filter((pin) => pin.item_type !== "view"), ...viewPins]);
    },
    [isDraggingRef, releaseClickGuard, reorderPins, reorderAll, scope, setLocalPinned, viewPins, visible],
  );

  if (visible.length === 0) return null;

  return (
    <PanelSection
      label={t(($) => $.sidebar.pinned_label)}
      collapsed={persistentPins ? false : collapsed}
      onCollapsedChange={persistentPins ? undefined : setCollapsed}
      action={<PinnedSectionSettings className={SECTION_SETTINGS_REVEAL_CLASS} />}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={displayed.map((pin) => pin.id)} strategy={verticalListSortingStrategy}>
          <PanelList>
            {displayed.map((pin) => (
              <PinRow
                key={pin.id}
                pin={pin}
                href={pinHref(p, pin)}
                active={isPinActive(pin)}
                onUnpin={() => pin.item_type === "view" ? unpinView(scope, pin.item_id) : deletePin.mutate({ itemType: pin.item_type, itemId: pin.item_id })}
                wsId={wsId}
              />
            ))}
          </PanelList>
        </SortableContext>
      </DndContext>
      {!persistentPins && visible.length > limit && (
        <button
          type="button"
          aria-expanded={expanded}
          className={cn(PANEL_ROW_CLASS, panelRowStateClass(false), "pl-[2.375rem] text-caption")}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t(($) => $.sidebar.show_fewer_pins)
            : t(($) => $.sidebar.show_more_pins, { count: visible.length - limit })}
        </button>
      )}
    </PanelSection>
  );
}

function SortablePinItem({
  pin,
  href,
  onUnpin,
  label,
  displayLabel = label,
  tooltip,
  iconNode,
  active,
  running = false,
  unread = false,
  labelSuffix,
  trailing,
  issue,
  onNavigate,
}: {
  pin: PinnedItem;
  href: string;
  onUnpin: () => void;
  label: string;
  displayLabel?: string;
  tooltip?: string;
  iconNode: React.ReactNode;
  active: boolean;
  /** Shimmers the label while an agent works on the pinned issue. */
  running?: boolean;
  /** Brightens the label while the issue has an unread agent result. */
  unread?: boolean;
  /** Right after the label, which truncates before it. */
  labelSuffix?: React.ReactNode;
  trailing?: React.ReactNode;
  /** A pinned issue's row opens the issue context menu on right-click. */
  issue?: Issue;
  onNavigate?: () => void;
}) {
  const { t } = useT("layout");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pin.id });

  const row = (
    <div
      {...panelRowAnchor(active)}
      className={cn(
        PANEL_ROW_CLASS,
        panelRowStateClass(active),
        issue && issueRowMenuOpenClass(active),
        "relative",
        trailing ? "pr-2" : "pr-8",
        isDragging && "pointer-events-none",
      )}
    >
      {iconNode}
      <AppLink
        href={href}
        onNavigateInPlace={onNavigate}
        newTabTitle={label}
        title={tooltip}
        draggable={false}
        aria-current={active ? "page" : undefined}
        className={cn(ISSUE_ROW_LINK_CLASS, "gap-2.5")}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <ShimmerText
            active={running}
            className={cn("min-w-0 truncate", SIDEBAR_SHIMMER_CLASS, unread && "text-foreground")}
          >
            {displayLabel}
          </ShimmerText>
          {labelSuffix}
        </span>
        {/* Holds the same right-edge slot as a tree row's avatars, and yields
            it to the unpin button on hover. */}
        {trailing && (
          <span className="flex shrink-0 items-center group-hover/pin:invisible group-focus-within/pin:invisible">
            {trailing}
          </span>
        )}
      </AppLink>
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/pin relative", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      {issue ? <IssueActionsContextMenu issue={issue}>{row}</IssueActionsContextMenu> : row}
      <TooltipHint label={t(($) => $.sidebar.unpin_tooltip)}>
        <button
          type="button"
          aria-label={t(($) => $.sidebar.unpin_tooltip)}
          className="absolute top-1/2 right-1.5 hidden size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground group-hover/pin:flex group-focus-within/pin:flex hover:bg-surface-selected hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onUnpin();
          }}
        >
          <X className="size-3" />
        </button>
      </TooltipHint>
    </li>
  );
}

/**
 * Resolves a pin's display data (label + status/icon) from the issue /
 * project / view detail cache. All three queries are declared unconditionally
 * with `enabled` gates so the hook order stays stable regardless of
 * `pin.item_type`.
 *
 * Loading renders a flat skeleton so the panel height doesn't jump. A missing
 * item (deleted / 404) renders nothing and unpins itself.
 */
function PinRow({
  pin,
  href,
  active,
  onUnpin,
  wsId,
}: {
  pin: PinnedItem;
  href: string;
  active: boolean;
  onUnpin: () => void;
  wsId: string;
}) {
  const { t: tProjects } = useT("projects");
  const isIssue = pin.item_type === "issue";
  const isView = pin.item_type === "view";
  const builtin = isView && pin.item_id.startsWith("builtin:") ? pin.item_id.slice(8) : null;
  const viewId = isView && pin.item_id.startsWith("view:") ? pin.item_id.slice(5) : "";
  const viewsQuery = useQuery({ ...issueViewEverywhereOptions(wsId), enabled: !!viewId });
  const builtinNav = useBuiltinViewNavigation();
  const builtinLabel = useBuiltinViewLabel();
  const paths = useWorkspacePaths();
  const { t } = useT("layout");
  const { t: tIssues } = useT("issues");
  const { pathname, searchParams } = useNavigation();
  const activeViews = useActiveIssueViewStore((s) => s.active);
  const setActiveView = useActiveIssueViewStore((s) => s.setActive);
  const persistentPins = usePersistentPins();
  const agents = useIssueAgentState(wsId, isIssue ? pin.item_id : "");
  const unread = useIssueUnread(wsId, isIssue ? pin.item_id : "");
  const statusCatalog = useIssueStatuses(wsId);
  const statusLabel = useStatusLabel(wsId);
  const issueQuery = useQuery({ ...issueDetailOptions(wsId, pin.item_id), enabled: isIssue });
  const projectQuery = useQuery({
    ...projectDetailOptions(wsId, pin.item_id),
    enabled: pin.item_type === "project",
  });

  const triggeredRef = useRef(false);
  useEffect(() => {
    const err = isIssue ? issueQuery.error : isView ? null : projectQuery.error;
    if (err instanceof ApiError && err.status === 404 && !triggeredRef.current) {
      triggeredRef.current = true;
      onUnpin();
    }
  }, [isIssue, isView, issueQuery.error, onUnpin, projectQuery.error]);

  if (isView) {
    if (builtin) {
      if (builtin === "my_issues" || builtin === "my_agents") {
        const agent = builtin === "my_agents";
        return <SortablePinItem pin={pin} href={agent ? paths.myAgents() : paths.myIssues()} onUnpin={onUnpin}
          label={agent ? tIssues(($) => $.scope.agents_label) : t(($) => $.nav.my_issues)}
          active={pathname === paths.myIssues() && agent === isMyAgentsSearch(searchParams)}
          iconNode={agent ? <Bot className="size-4" /> : <CircleUser className="size-4" />} />;
      }
      if (!BUILTIN_VIEW_KEYS.includes(builtin as BuiltinViewKey)) return null;
      const key = builtin as BuiltinViewKey;
      const containerKey = issueViewContainerKey(wsId, { scope_type: "workspace" });
      const selected = pathname === paths.issues() && (activeViews[containerKey] ?? null) === (key === "all_issues" ? null : key);
      return <SortablePinItem pin={pin} href={builtinNav.hrefFor(key)} onUnpin={onUnpin} label={builtinLabel(key)} active={selected} iconNode={BUILTIN_VIEW_ICON[key]} onNavigate={() => builtinNav.prepare(key)} />;
    }
    if (viewsQuery.isPending) return <PinSkeleton />;
    const view = viewsQuery.data?.find((item) => item.id === viewId);
    if (!view) return null;
    const target = issueViewTarget(wsId, view, paths);
    return <SortablePinItem pin={pin} href={target.href} onUnpin={onUnpin} label={view.name} active={pathname === target.path && activeViews[target.containerKey] === view.id} iconNode={<Layers className="size-4" />} onNavigate={() => setActiveView(target.containerKey, view.id)} />;
  }

  if (isIssue) {
    if (issueQuery.isPending) return <PinSkeleton />;
    if (issueQuery.isError || !issueQuery.data) return null;
    const issue = issueQuery.data;
    const identifier = issue.identifier?.trim();
    const titleStartsWithId = !!identifier && issue.title.slice(0, identifier.length).toUpperCase() === identifier.toUpperCase();
    const rest = titleStartsWithId ? issue.title.slice(identifier.length) : "";
    const separator = rest.match(/^(?:\s*[:：—–-]\s*|\s+)/u);
    const shortened = separator ? rest.slice(separator[0].length).trimStart() : "";
    const baseTitle = shortened || issue.title;
    // Imported bug titles start with their build changelist, not the Multica ID.
    // Keep all following category tags and never turn a title into an empty row.
    const withoutChangelist = baseTitle.replace(/^(?:\[BUG-\d+\]\s*)?(?:【CL\s*\d+】\s*)?/i, "");
    const displayTitle = withoutChangelist || baseTitle;
    const tooltip = identifier && !shortened && issue.title.toUpperCase() !== identifier.toUpperCase()
      ? `${identifier} · ${issue.title}`
      : issue.title;
    return (
      <SortablePinItem
        pin={pin}
        href={unreadIssueHref(href, unread)}
        onUnpin={onUnpin}
        label={issue.title}
        displayLabel={persistentPins ? displayTitle : issue.title}
        tooltip={persistentPins ? tooltip : undefined}
        active={active}
        running={!!agents?.running}
        unread={!agents && !!unread}
        trailing={agents ? <IssueAgentBadge agents={agents} /> : unread && <IssueUnreadDot unread={unread} />}
        issue={issue}
        iconNode={
          <SidebarIssueStatus
            issue={issue}
            color={statusCatalog.colorOf(issue.status)}
            icon={statusCatalog.iconOf(issue.status)}
            label={statusLabel(issue.status)}
            className="size-3.5"
          />
        }
      />
    );
  }

  if (projectQuery.isPending) return <PinSkeleton />;
  if (projectQuery.isError || !projectQuery.data) return null;
  const project = projectQuery.data;
  return (
    <SortablePinItem
      pin={pin}
      href={href}
      onUnpin={onUnpin}
      label={project.title}
      active={active}
      labelSuffix={project.visibility === "private" && <PrivateProjectLock />}
      trailing={
        project.archived_at ? (
          <Archive
            role="img"
            aria-label={tProjects(($) => $.archive.badge)}
            className="size-3 shrink-0 text-muted-foreground"
          />
        ) : undefined
      }
      iconNode={
        project.icon ? <ProjectIcon project={project} size="md" /> : <Folder className="size-4 shrink-0" />
      }
    />
  );
}

function PinSkeleton() {
  return (
    <li className="flex h-8 items-center gap-2.5 px-3">
      <div className="size-3.5 shrink-0 rounded-sm bg-muted" />
      <div className="h-3 w-24 rounded-xs bg-muted" />
    </li>
  );
}
