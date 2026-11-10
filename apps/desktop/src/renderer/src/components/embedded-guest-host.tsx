import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { pinListOptions } from "@multica/core/pins/queries";
import { getCurrentSlug, subscribeToCurrentSlug } from "@multica/core/platform";
import { workspaceListOptions } from "@multica/core/workspace";
import { useNavigation } from "@multica/views/navigation";
import { useT } from "@multica/views/i18n";
import { frozenIssueKey } from "../../../shared/frozen-issue-key";
import { CachedInboxOutletProvider, type CachedInboxOutletProps } from "@multica/views/issues/surface/cached-inbox-outlet";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { PinnedIssueCacheContext } from "./pinned-issue-cache-context";
import { embeddedCanonicalIssuePath, parsePinnedIssueRoute } from "./pinned-issue-route";
import { observeSurfaceBounds } from "./surface-bounds";

type Guest = { key: string; token: string; url: string; workspaceId: string; issueId: string; userId: string; ready: boolean };
type PoolGuest = { token: string; url: string; workspaceId: string; slug: string; userId: string; ready: boolean };
type InboxTarget = { props: CachedInboxOutletProps; element: HTMLDivElement };

function InboxCacheTarget({ props, eligible, register }: { props: CachedInboxOutletProps; eligible: boolean; register: (source: "page" | "dock", target: InboxTarget | null) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  useLayoutEffect(() => {
    if (!eligible || !props.active || !element.current) return;
    const target: InboxTarget = { element: element.current, props: { ...props, onDone: () => latest.current.onDone(), onDelete: () => latest.current.onDelete() } };
    register(props.source, target);
    return () => register(props.source, null);
  }, [eligible, props.active, props.interactive, props.issueId, props.workspaceId, props.source, props.highlightCommentId, props.highlightRequestToken, register]);
  return eligible ? <div ref={element} className="relative flex min-h-0 flex-1 bg-background" /> : props.children;
}
const subscribeWorkspace = (notify: () => void) => subscribeToCurrentSlug(() => notify());

function PinWatch({ workspaceId, userId, guests, remove }: { workspaceId: string; userId: string; guests: Guest[]; remove: (tokens: string[]) => void }) {
  const { data } = useQuery({ ...pinListOptions(workspaceId, userId), enabled: false });
  useEffect(() => {
    if (!data) return;
    const pinned = new Set(data.filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id));
    const removed = guests.filter((guest) => guest.workspaceId === workspaceId && guest.userId === userId && !pinned.has(guest.issueId)).map((guest) => guest.token);
    if (removed.length) remove(removed);
  }, [data, guests, workspaceId, userId, remove]);
  return null;
}

/** Dev-only webview experiment; production never mounts this host. */
export function EmbeddedGuestHost({ children }: { children: ReactNode }) {
  const { t } = useT("common");
  const enabled = useDesktopPrefsStore((state) => state.pinnedIssueCacheEnabled);
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const slug = useSyncExternalStore(subscribeWorkspace, getCurrentSlug, getCurrentSlug);
  const path = useRenderedRouteStore((state) => state.pathname);
  const mainRoute = parsePinnedIssueRoute(path);
  const [inboxTargets, setInboxTargets] = useState<{ page: InboxTarget | null; dock: InboxTarget | null }>({ page: null, dock: null });
  const inboxTarget = !mainRoute ? inboxTargets.page ?? inboxTargets.dock : null;
  const extraTarget = mainRoute ? inboxTargets.dock ?? inboxTargets.page : inboxTargets.page && inboxTargets.dock ? inboxTargets.dock : null;
  const inboxTargetRef = useRef(inboxTarget); inboxTargetRef.current = inboxTarget;
  const extraTargetRef = useRef(extraTarget); extraTargetRef.current = extraTarget;
  const route = mainRoute ?? (inboxTarget && slug ? { slug, issue: inboxTarget.props.issueId } : null);
  const effectivePath = mainRoute ? path : inboxTarget && slug ? `/${encodeURIComponent(slug)}/issues/${encodeURIComponent(inboxTarget.props.issueId)}` : path;
  const navigation = useNavigation();
  const { data: workspaces } = useQuery(workspaceListOptions());
  const workspace = workspaces?.find((item) => item.slug === slug);
  const workspaceId = workspace?.id ?? "";
  const ready = !!slug && (!route || route.slug === slug);
  const issue = useCanonicalIssue(enabled && ready ? workspaceId : "", route?.issue ?? "");
  const { data: pins } = useQuery({ ...pinListOptions(workspaceId, userId), enabled: enabled && ready && !!workspaceId && !!userId });
  const pinnedIds = useMemo(() => new Set((pins ?? []).filter((pin) => pin.item_type === "issue").map((pin) => pin.item_id)), [pins]);
  const wanted = enabled && ready && !!route && !!issue.canonicalId && pinnedIds.has(issue.canonicalId) && !!userId && !!workspaceId
    ? frozenIssueKey({ userId, workspaceId, issueId: issue.canonicalId }) : null;
  const inboxBaseKey = enabled && extraTarget && extraTarget.props.active && extraTarget.props.workspaceId === workspaceId && pinnedIds.has(extraTarget.props.issueId) && userId && workspaceId
    ? frozenIssueKey({ userId, workspaceId, issueId: extraTarget.props.issueId }) : null;
  const secondaryWanted = inboxBaseKey ? (inboxBaseKey === wanted ? `${inboxBaseKey}::${extraTarget?.props.source ?? "dock"}` : inboxBaseKey) : null;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [pool, setPool] = useState<PoolGuest | null>(null);
  const poolRef = useRef(pool); poolRef.current = pool;
  const guestsRef = useRef(guests); guestsRef.current = guests;
  const alive = useRef(true);
  const [visible, setVisible] = useState<string | null>(null);
  const [secondaryVisible, setSecondaryVisible] = useState<string | null>(null);
  const hostElement = useRef<HTMLDivElement>(null);
  const [mainBounds, setMainBounds] = useState<CSSProperties>({ inset: 0, width: "100%", height: "100%" });
  const [inboxBounds, setInboxBounds] = useState<CSSProperties>({ inset: 0, width: "100%", height: "100%" });
  useLayoutEffect(() => {
    const host = hostElement.current;
    const target = !mainRoute && inboxTarget ? inboxTarget.element : host?.querySelector<HTMLElement>('[data-testid="dock-main-content"]');
    if (!host || !target || typeof ResizeObserver === "undefined") return;
    return observeSurfaceBounds(host, target, (next) => setMainBounds((old) => old.left === next.left && old.top === next.top && old.width === next.width && old.height === next.height && old.clipPath === next.clipPath ? old : next));
  }, [workspaceId, mainRoute?.issue, inboxTarget?.element]);
  useLayoutEffect(() => {
    const host = hostElement.current, target = extraTarget?.element;
    if (!host || !target || typeof ResizeObserver === "undefined") return;
    return observeSurfaceBounds(host, target, (next) => setInboxBounds((old) => old.left === next.left && old.top === next.top && old.width === next.width && old.height === next.height && old.clipPath === next.clipPath ? old : next));
  }, [extraTarget?.element]);
  const [retry, setRetry] = useState(0);
  const preparing = useRef(new Set<string>());
  const poolClaim = useRef<string | null>(null);
  const earlyReady = useRef(new Set<string>());
  const attempts = useRef(new Map<string, number>());
  const failed = useRef(new Set<string>());
  const previousWanted = useRef(wanted);
  if (wanted && previousWanted.current && previousWanted.current !== wanted) failed.current.clear();
  if (wanted) previousWanted.current = wanted;
  const wantedRef = useRef(wanted); wantedRef.current = wanted;
  const secondaryWantedRef = useRef(secondaryWanted); secondaryWantedRef.current = secondaryWanted;
  const selected = guests.find((guest) => guest.key === wanted);
  const secondary = guests.find((guest) => guest.key === secondaryWanted);
  useEffect(() => { console.info("[embedded-guest-state]", JSON.stringify({ wanted: !!wanted, selected: !!selected, ready: !!selected?.ready, visible: !!visible, guests: guests.length, pins: pinnedIds.size })); }, [wanted, selected?.ready, visible, guests.length, pinnedIds.size]);
  // A pinned issue starts in its guest: mounting the ordinary detail as well
  // would render the same long timeline twice before the first switch.
  const snapshot = { enabled: !!mainRoute && !!wanted && !failed.current.has(wanted), workspaceId, pinnedIds };
  const registerInbox = useMemo(() => (source: "page" | "dock", target: InboxTarget | null) => setInboxTargets((old) => old[source] === target ? old : { ...old, [source]: target }), []);
  const renderInbox = useMemo(() => (props: CachedInboxOutletProps) => <InboxCacheTarget props={props}
    eligible={import.meta.env.VITE_INBOX_CACHE_EXPERIMENT === "1" && props.cacheAllowed !== false && enabled && !!userId && !!workspaceId && props.workspaceId === workspaceId && pinnedIds.has(props.issueId) && !failed.current.has(frozenIssueKey({ userId, workspaceId, issueId: props.issueId })) && !failed.current.has(`${frozenIssueKey({ userId, workspaceId, issueId: props.issueId })}::${props.source}`)} register={registerInbox} />,
    [enabled, mainRoute?.issue, userId, workspaceId, pinnedIds, registerInbox, retry]);
  const remove = useMemo(() => (tokens: string[]) => {
    const set = new Set(tokens);
    for (const token of set) void window.desktopAPI.removeEmbeddedGuest(token);
    setGuests((old) => old.filter((guest) => !set.has(guest.token)));
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; for (const guest of guestsRef.current) void window.desktopAPI.removeEmbeddedGuest(guest.token); if (poolRef.current) void window.desktopAPI.removeEmbeddedGuest(poolRef.current.token); };
  }, []);

  useEffect(() => {
    const current = poolRef.current;
    if (current && (!enabled || current.userId !== userId || current.workspaceId !== workspaceId || current.slug !== slug)) {
      void window.desktopAPI.removeEmbeddedGuest(current.token);
      setPool(null);
    }
  }, [enabled, userId, workspaceId, slug]);
  useEffect(() => {
    if (!enabled || !userId || !workspaceId || !slug || pool || !window.desktopAPI.prepareEmbeddedPool) return;
    let cancelled = false;
    void window.desktopAPI.prepareEmbeddedPool({ userId, workspaceId, workspaceSlug: slug }).then((prepared) => {
      if (!prepared) return;
      if (cancelled || !alive.current) { void window.desktopAPI.removeEmbeddedGuest(prepared.token); return; }
      setPool({ ...prepared, userId, workspaceId, slug, ready: false });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, userId, workspaceId, slug, pool]);
  useEffect(() => window.desktopAPI.onEmbeddedPoolReady?.((token) => setPool((old) => old?.token === token ? { ...old, ready: true } : old)), []);

  useEffect(() => window.desktopAPI.onEmbeddedGuestReady((token) => { console.info("[embedded-guest] renderer-ready"); if (!guestsRef.current.some((guest) => guest.token === token)) earlyReady.current.add(token); setGuests((old) => old.map((guest) => guest.token === token ? { ...guest, ready: true } : guest)); }), []);
  useEffect(() => window.desktopAPI.onEmbeddedIssueNavigation((raw) => {
    if (!raw || typeof raw !== "object") return;
    const message = raw as { kind?: unknown; path?: unknown; replace?: unknown };
    if (message.kind === "back") { navigation.back(); return; }
    if ((message.kind === "shell" || message.kind === "current-issue") && typeof message.path === "string") {
      if (message.replace) navigation.replace(message.path); else navigation.push(message.path);
    }
  }), [navigation]);
  useEffect(() => window.desktopAPI.onEmbeddedGuestAction?.((raw) => {
    if (!raw || typeof raw !== "object") return;
    const message = raw as { token?: unknown; action?: unknown };
    const current = guestsRef.current.find((item) => item.token === message.token);
    const target = current?.key === secondaryWantedRef.current ? extraTargetRef.current : inboxTargetRef.current;
    if (!target || !current) return;
    if (message.action === "done") target.props.onDone();
    else if (message.action === "delete") target.props.onDelete();
  }), []);
  useEffect(() => {
    if (!enabled || !userId) { if (guests.length) remove(guests.map((guest) => guest.token)); }
    else { const old = guests.filter((guest) => guest.userId !== userId); if (old.length) remove(old.map((guest) => guest.token)); }
  }, [enabled, userId, guests, remove]);
  useEffect(() => {
    // A second instance is needed only while the same issue is visible twice.
    const redundant = guests.filter((guest) => /::(?:page|dock)$/.test(guest.key) && guest.key !== secondaryWanted);
    if (redundant.length) remove(redundant.map((guest) => guest.token));
  }, [guests, secondaryWanted, remove]);
  useEffect(() => {
    if (!wanted || selected?.ready || failed.current.has(wanted)) return;
    const key = wanted;
    const timeout = window.setTimeout(() => {
      if (wantedRef.current !== key) return;
      failed.current.add(key);
      const guest = guestsRef.current.find((item) => item.key === key);
      if (guest) remove([guest.token]);
      setRetry((value) => value + 1);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [wanted, selected?.ready, remove]);
  useEffect(() => {
    if (!wanted || !route || !issue.canonicalId || !effectivePath || selected || preparing.current.has(wanted) || failed.current.has(wanted)) return;
    const key = wanted, issueId = issue.canonicalId;
    preparing.current.add(key);
    const guestPath = embeddedCanonicalIssuePath(effectivePath, route.slug, issueId);
    const request = { userId, workspaceId, issueId, path: guestPath, title: issue.issue?.title ?? "Issue" };
    const warmed = poolRef.current;
    const useWarmed = warmed?.ready && warmed.userId === userId && warmed.workspaceId === workspaceId && warmed.slug === route.slug && !!window.desktopAPI.assignEmbeddedPool && !poolClaim.current;
    if (useWarmed) poolClaim.current = warmed.token;
    const obtain = useWarmed
      ? window.desktopAPI.assignEmbeddedPool(warmed.token, request).then((ok) => {
          if (!ok) { setPool((old) => old?.token === warmed.token ? null : old); void window.desktopAPI.removeEmbeddedGuest(warmed.token); return window.desktopAPI.prepareEmbeddedGuest(request); }
          return { token: warmed.token, url: warmed.url, key };
        })
      : window.desktopAPI.prepareEmbeddedGuest(request);
    void obtain.then((prepared) => {
      preparing.current.delete(key);
      if (!prepared) {
        const count = (attempts.current.get(key) ?? 0) + 1; attempts.current.set(key, count);
        if (count < 5 && wantedRef.current === key) window.setTimeout(() => setRetry((value) => value + 1), 500);
        else if (wantedRef.current === key) { failed.current.add(key); setRetry((value) => value + 1); }
        return;
      }
      attempts.current.delete(key);
      if (!alive.current || wantedRef.current !== key || failed.current.has(key)) { void window.desktopAPI.removeEmbeddedGuest(prepared.token); setPool((old) => old?.token === prepared.token ? null : old); return; }
      const alreadyReady = earlyReady.current.delete(prepared.token);
      setGuests((old) => old.some((guest) => guest.key === key) ? old : [...old, { ...prepared, workspaceId, issueId, userId, ready: alreadyReady }]);
      setPool((old) => old?.token === prepared.token ? null : old);
    }).catch(() => { preparing.current.delete(key); if (useWarmed) { setPool((old) => old?.token === warmed.token ? null : old); void window.desktopAPI.removeEmbeddedGuest(warmed.token); } if (wantedRef.current === key) { failed.current.add(key); setRetry((value) => value + 1); } }).finally(() => { if (useWarmed && poolClaim.current === warmed.token) poolClaim.current = null; });
  }, [wanted, route?.issue, issue.canonicalId, issue.issue?.title, effectivePath, selected, userId, workspaceId, retry]);
  useEffect(() => {
    if (!secondaryWanted || !extraTarget || !slug || secondary || preparing.current.has(secondaryWanted) || failed.current.has(secondaryWanted)) return;
    const key = secondaryWanted, issueId = extraTarget.props.issueId;
    preparing.current.add(key);
    const request = { userId, workspaceId, issueId, path: `/${encodeURIComponent(slug)}/issues/${encodeURIComponent(issueId)}`, title: "Issue" };
    const warmed = poolRef.current;
    const useWarmed = warmed?.ready && warmed.userId === userId && warmed.workspaceId === workspaceId && warmed.slug === slug && !!window.desktopAPI.assignEmbeddedPool && !poolClaim.current;
    if (useWarmed) poolClaim.current = warmed.token;
    const obtain = useWarmed ? window.desktopAPI.assignEmbeddedPool(warmed.token, request).then((ok) => {
      if (!ok) { setPool((old) => old?.token === warmed.token ? null : old); void window.desktopAPI.removeEmbeddedGuest(warmed.token); return window.desktopAPI.prepareEmbeddedGuest(request); }
      return { token: warmed.token, url: warmed.url, key };
    }) : window.desktopAPI.prepareEmbeddedGuest(request);
    void obtain.then((prepared) => {
      preparing.current.delete(key);
      if (!prepared) { failed.current.add(key); setRetry((value) => value + 1); return; }
      if (!alive.current || secondaryWantedRef.current !== key || failed.current.has(key)) { void window.desktopAPI.removeEmbeddedGuest(prepared.token); setPool((old) => old?.token === prepared.token ? null : old); return; }
      const alreadyReady = earlyReady.current.delete(prepared.token);
      setGuests((old) => old.some((item) => item.key === key) ? old : [...old, { ...prepared, key, workspaceId, issueId, userId, ready: alreadyReady }]);
      setPool((old) => old?.token === prepared.token ? null : old);
    }).catch(() => { preparing.current.delete(key); if (useWarmed) { setPool((old) => old?.token === warmed.token ? null : old); void window.desktopAPI.removeEmbeddedGuest(warmed.token); } failed.current.add(key); setRetry((value) => value + 1); }).finally(() => { if (useWarmed && poolClaim.current === warmed.token) poolClaim.current = null; });
  }, [secondaryWanted, extraTarget?.props.issueId, slug, secondary, userId, workspaceId, retry]);
  useEffect(() => {
    if (!secondaryWanted || secondary?.ready || failed.current.has(secondaryWanted)) return;
    const key = secondaryWanted;
    const timer = window.setTimeout(() => {
      if (secondaryWantedRef.current !== key) return;
      failed.current.add(key);
      const guest = guestsRef.current.find((item) => item.key === key);
      if (guest) remove([guest.token]);
      setRetry((value) => value + 1);
    }, 15000);
    return () => clearTimeout(timer);
  }, [secondaryWanted, secondary?.ready, remove]);
  useEffect(() => {
    let cancelled = false;
    if (secondaryWanted && window.desktopAPI.showEmbeddedGuestSurfaces) {
      const main = selected?.ready ? selected : null, extra = secondary?.ready ? secondary : null;
      const tokens = [main?.token, extra?.token].filter((value): value is string => !!value);
      let finished = false;
      const fallback = () => {
        if (cancelled || finished) return;
        finished = true;
        failed.current.add(secondaryWanted);
        setSecondaryVisible(null);
        if (extra) remove([extra.token]);
        setRetry((value) => value + 1);
      };
      const timeout = window.setTimeout(fallback, 5000);
      void window.desktopAPI.showEmbeddedGuestSurfaces(tokens).then(async (ok) => {
        if (!ok) { fallback(); return; }
        if (cancelled || finished) return;
        if (window.desktopAPI.setEmbeddedGuestPresentation) {
          const firstTarget = !mainRoute ? inboxTargetRef.current : null;
          if (main && !await window.desktopAPI.setEmbeddedGuestPresentation(main.token, firstTarget ? { surface: firstTarget.props.source, highlightCommentId: firstTarget.props.highlightCommentId, highlightRequestToken: firstTarget.props.highlightRequestToken } : { surface: "main" })) { fallback(); return; }
          const target = extraTargetRef.current;
          if (extra && target && !await window.desktopAPI.setEmbeddedGuestPresentation(extra.token, { surface: target.props.source, highlightCommentId: target.props.highlightCommentId, highlightRequestToken: target.props.highlightRequestToken })) { fallback(); return; }
        }
        if (!cancelled && !finished) { finished = true; clearTimeout(timeout); setVisible(main?.key ?? null); setSecondaryVisible(extra?.key ?? null); }
      }).catch(fallback);
      return () => { cancelled = true; clearTimeout(timeout); };
    }
    setSecondaryVisible(null);
    if (!wanted || !selected?.ready) { setVisible(null); void window.desktopAPI.hideEmbeddedGuest().catch(() => {}); return; }
    console.info("[embedded-guest] renderer-activating");
    let finished = false;
    const fallback = () => { if (!cancelled && !finished) { finished = true; failed.current.add(selected.key); setVisible(null); remove([selected.token]); } };
    const timeout = window.setTimeout(fallback, 5000);
    void window.desktopAPI.activateEmbeddedGuest(selected.token).then(async (ok) => {
      if (ok && window.desktopAPI.setEmbeddedGuestPresentation) {
        const target = !mainRoute ? inboxTargetRef.current : null;
        ok = await window.desktopAPI.setEmbeddedGuestPresentation(selected.token, target
          ? { surface: target.props.source, highlightCommentId: target.props.highlightCommentId, highlightRequestToken: target.props.highlightRequestToken }
          : { surface: "main" });
      }
      clearTimeout(timeout); if (!cancelled && !finished && ok) { finished = true; setVisible(selected.key); } else if (!ok) fallback();
    }).catch(() => { clearTimeout(timeout); fallback(); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [wanted, selected?.token, selected?.ready, secondaryWanted, secondary?.token, secondary?.ready, remove, mainRoute?.issue, inboxTarget?.props.highlightCommentId, inboxTarget?.props.highlightRequestToken, extraTarget?.props.highlightCommentId, extraTarget?.props.highlightRequestToken]);

  const watchers = [...new Set(guests.map((guest) => `${guest.userId}\u0000${guest.workspaceId}`))];
  return <PinnedIssueCacheContext.Provider value={snapshot}><CachedInboxOutletProvider value={renderInbox}>
    {watchers.map((value) => { const [watchUser, watchWorkspace] = value.split("\u0000"); return <PinWatch key={value} workspaceId={watchWorkspace!} userId={watchUser!} guests={guests} remove={remove} />; })}
    <div ref={hostElement} className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {[...guests, ...(pool ? [{ ...pool, key: "", issueId: "" }] : [])].map((guest) => {
        const isSecondary = !!secondaryWanted && guest.key === secondaryVisible && guest.key === secondaryWanted;
        const isPrimary = !!wanted && !!selected?.ready && visible === guest.key;
        const interactive = isSecondary ? extraTarget?.props.interactive !== false : mainRoute ? true : inboxTarget?.props.interactive !== false;
        return createElement("webview", { key: guest.token, src: guest.url, style: { display: "flex", visibility: isPrimary || isSecondary ? "visible" : "hidden", pointerEvents: (isPrimary || isSecondary) && interactive ? "auto" : "none", position: "absolute", zIndex: (isSecondary ? extraTarget?.props.source : !mainRoute ? inboxTarget?.props.source : "main") === "dock" ? 11 : 1, ...(isSecondary ? inboxBounds : mainBounds) } });
      })}
      {!!wanted && !!selected?.ready && !!visible && visible !== wanted && <div aria-busy="true" className="absolute bg-background/40" style={{ ...mainBounds, zIndex: !mainRoute && inboxTarget?.props.source === "dock" ? 12 : 2 }} />}
      {!!wanted && !failed.current.has(wanted) && (!selected?.ready || !visible) && <div role="status" className="absolute flex items-center justify-center bg-background text-muted-foreground" style={{ ...mainBounds, zIndex: !mainRoute && inboxTarget?.props.source === "dock" ? 12 : 2 }}>{t(($) => $.loading)}</div>}
      {!!secondaryWanted && !failed.current.has(secondaryWanted) && (!secondary?.ready || secondaryVisible !== secondaryWanted) && <div role="status" className="absolute flex items-center justify-center bg-background text-muted-foreground" style={{ ...inboxBounds, zIndex: 12 }}>{t(($) => $.loading)}</div>}
    </div>
  </CachedInboxOutletProvider></PinnedIssueCacheContext.Provider>;
}
