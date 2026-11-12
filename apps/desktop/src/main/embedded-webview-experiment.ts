import { BrowserWindow, ipcMain, type WebContents } from "electron";
import { randomUUID } from "crypto";
import { join } from "path";
import { encodeIssueWindowArgument, parseIssueWindowRequest, type IssueWindowContext } from "../shared/issue-window";
import { frozenIssueKey } from "../shared/frozen-issue-key";
import { createRendererWebPreferences } from "./renderer-web-preferences";
import { EmbeddedVisibleSet } from "./embedded-visible-set";
import { parseEmbeddedIssuePresentation } from "../shared/embedded-issue-presentation";
import { openExternalSafely } from "./external-url";

type Dependencies = { isMain: (window: BrowserWindow) => boolean; userId: (window: BrowserWindow) => string | null; workspaceSlug: (window: BrowserWindow) => string | null; locale: () => string; rendererUrl: string };
type Ticket = { owner: BrowserWindow; userId: string; workspaceId: string; key: string; context: IssueWindowContext; used: boolean; pool: boolean; poolReady: boolean };
type Guest = { owner: BrowserWindow; key: string; contents: WebContents; frozen: boolean; assignedAt: number; frozenAt: number | null };
let deps: Dependencies | null = null;
const tickets = new Map<string, Ticket>();
const pending = new Map<BrowserWindow, Ticket[]>();
const guests = new Map<string, Guest>();
const byContents = new Map<WebContents, Guest>();
const active = new Map<BrowserWindow, EmbeddedVisibleSet>();
const transitions = new Map<BrowserWindow, Promise<void>>();
function visibleSet(owner: BrowserWindow) {
  let state = active.get(owner);
  if (state) return state;
  state = new EmbeddedVisibleSet({
    async freeze(token) {
      const guest = guests.get(token);
      if (!guest || guest.owner !== owner || guest.contents.isDestroyed() || guest.frozen) return;
      await guest.contents.debugger.sendCommand("Page.setWebLifecycleState", { state: "frozen" });
      guest.frozen = true; guest.frozenAt = performance.now();
    },
    async resume(token) {
      const guest = guests.get(token);
      if (!guest || guest.owner !== owner || guest.contents.isDestroyed()) throw new Error("Embedded guest unavailable");
      if (!guest.contents.debugger.isAttached()) { guest.contents.debugger.attach("1.3"); await guest.contents.debugger.sendCommand("Page.enable"); }
      if (guest.frozen) { await guest.contents.debugger.sendCommand("Page.setWebLifecycleState", { state: "active" }); console.info("[embedded-guest] resume", JSON.stringify({ frozenMs: guest.frozenAt === null ? null : Math.round(performance.now() - guest.frozenAt) })); guest.frozen = false; guest.frozenAt = null; }
    },
  });
  active.set(owner, state);
  return state;
}
function enqueue(owner: BrowserWindow, action: () => Promise<void>) {
  const next = (transitions.get(owner) ?? Promise.resolve()).then(action);
  transitions.set(owner, next.catch(() => {}));
  return next;
}
function destroyGuest(token: string) {
  const guest = guests.get(token); if (!guest) return;
  guests.delete(token); byContents.delete(guest.contents);
  active.get(guest.owner)?.forget(token);
  if (!guest.contents.isDestroyed()) { if (guest.contents.debugger.isAttached()) guest.contents.debugger.detach(); guest.contents.close(); }
}
export function clearEmbeddedWebviews(owner?: BrowserWindow) {
  for (const [token, guest] of guests) if (!owner || guest.owner === owner) destroyGuest(token);
  for (const [token, ticket] of tickets) if (!owner || ticket.owner === owner) tickets.delete(token);
  if (owner) { pending.delete(owner); active.delete(owner); } else { pending.clear(); active.clear(); }
}
export function installEmbeddedWebviewHost(owner: BrowserWindow) {
  owner.webContents.on("will-attach-webview", (event, preferences, params) => {
    try {
      const url = new URL(params.src), base = new URL(deps!.rendererUrl);
      const token = url.searchParams.get("embedded_ticket") ?? "", ticket = tickets.get(token);
      if (url.origin !== base.origin || url.pathname !== base.pathname || !ticket || ticket.used || ticket.owner !== owner || deps!.userId(owner) !== ticket.userId || deps!.workspaceSlug(owner) !== ticket.context.workspaceSlug) { event.preventDefault(); return; }
      ticket.used = true;
      Object.assign(preferences, createRendererWebPreferences(join(__dirname, "../preload/index.js"), deps!.locale(), [encodeIssueWindowArgument(ticket.context), "--multica-embedded-issue=1", ...(ticket.pool ? ["--multica-embedded-pool=1"] : [])]));
      preferences.nodeIntegration = false; preferences.contextIsolation = true; preferences.sandbox = true; preferences.webviewTag = false; preferences.backgroundThrottling = true;
      delete params.preload;
      (pending.get(owner) ?? (pending.set(owner, []), pending.get(owner)!)).push(ticket);
    } catch { event.preventDefault(); }
  });
  owner.webContents.on("did-attach-webview", (_event, contents) => {
    const ticket = pending.get(owner)?.shift(); if (!ticket) { contents.close(); return; }
    const token = [...tickets].find(([, value]) => value === ticket)?.[0]; if (!token) { contents.close(); return; }
    const guest: Guest = { owner, key: ticket.key, contents, frozen: false, assignedAt: performance.now(), frozenAt: null };
    guests.set(token, guest); byContents.set(contents, guest);
    console.info("[embedded-guest] attached");
    contents.on("console-message", (details) => {
      if (details.message.includes("[issue-load-performance]")) console.info("[embedded-guest-performance]", details.message);
      else if (details.level === "error") console.error("[embedded-guest-error]", details.message.slice(0, 300));
    });
    contents.on("did-start-loading", () => console.info("[embedded-guest] loading"));
    contents.on("render-process-gone", (_event, details) => console.error("[embedded-guest] renderer-gone", details.reason));
    contents.on("unresponsive", () => console.error("[embedded-guest] unresponsive"));
    contents.setWindowOpenHandler(({ url }) => {
      void openExternalSafely(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => { try { const destination = new URL(url), base = new URL(deps!.rendererUrl); if (destination.origin !== base.origin || destination.pathname !== base.pathname) event.preventDefault(); } catch { event.preventDefault(); } });
    contents.once("destroyed", () => { guests.delete(token); byContents.delete(contents); tickets.delete(token); active.get(owner)?.forget(token); });
  });
  owner.once("closed", () => clearEmbeddedWebviews(owner));
}
export function setupEmbeddedWebviewExperiment(options: Dependencies) {
  deps = options;
  const ownerFor = (sender: WebContents) => { const owner = BrowserWindow.fromWebContents(sender); return owner && options.isMain(owner) && options.userId(owner) ? owner : null; };
  ipcMain.handle("embedded-guest:prepare", (event, raw: unknown) => {
    const owner = ownerFor(event.sender); if (!owner || !raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>, context = parseIssueWindowRequest(input), userId = options.userId(owner);
    if (!context || !userId || input.userId !== userId || context.workspaceSlug !== options.workspaceSlug(owner) || typeof input.workspaceId !== "string" || typeof input.issueId !== "string") return null;
    let key: string; try { key = frozenIssueKey({ userId, workspaceId: input.workspaceId, issueId: input.issueId }); } catch { return null; }
    const token = randomUUID(); tickets.set(token, { owner, userId, workspaceId: input.workspaceId, key, context, used: false, pool: false, poolReady: false });
    const url = new URL(options.rendererUrl); url.searchParams.set("embedded_ticket", token);
    return { token, key, url: url.toString() };
  });
  ipcMain.handle("embedded-pool:prepare", (event, raw: unknown) => {
    const owner = ownerFor(event.sender); if (!owner || !raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>, userId = options.userId(owner), slug = options.workspaceSlug(owner);
    if (!userId || !slug || input.userId !== userId || input.workspaceSlug !== slug || typeof input.workspaceId !== "string") return null;
    if ([...tickets.values()].some((ticket) => ticket.owner === owner && ticket.pool)) return null;
    const context = parseIssueWindowRequest({ path: `/${encodeURIComponent(slug)}/issues/PREWARM`, title: "Issue" });
    if (!context) return null;
    const token = randomUUID();
    tickets.set(token, { owner, userId, workspaceId: input.workspaceId, key: "", context, used: false, pool: true, poolReady: false });
    const url = new URL(options.rendererUrl); url.searchParams.set("embedded_ticket", token);
    return { token, url: url.toString() };
  });
  ipcMain.on("embedded-pool:ready", (event) => {
    const guest = byContents.get(event.sender); if (!guest || guest.owner.isDestroyed()) return;
    const entry = [...guests].find(([, value]) => value === guest); if (!entry) return;
    const [token] = entry, ticket = tickets.get(token);
    if (!ticket?.pool || ticket.userId !== options.userId(guest.owner) || ticket.context.workspaceSlug !== options.workspaceSlug(guest.owner)) return;
    ticket.poolReady = true;
    console.info("[embedded-pool] ready");
    guest.owner.webContents.send("embedded-pool:ready", token);
  });
  ipcMain.handle("embedded-pool:assign", (event, token: unknown, raw: unknown) => {
    const owner = ownerFor(event.sender); if (!owner || typeof token !== "string" || !raw || typeof raw !== "object") return false;
    const ticket = tickets.get(token), guest = guests.get(token), input = raw as Record<string, unknown>;
    const context = parseIssueWindowRequest(input), userId = options.userId(owner);
    if (!ticket?.pool || !ticket.poolReady || ticket.owner !== owner || !guest || guest.contents.isDestroyed() || !context || !userId || userId !== ticket.userId || input.userId !== userId || input.workspaceId !== ticket.workspaceId || context.workspaceSlug !== ticket.context.workspaceSlug || context.workspaceSlug !== options.workspaceSlug(owner) || typeof input.issueId !== "string" || context.issueId !== input.issueId) return false;
    let key: string; try { key = frozenIssueKey({ userId, workspaceId: input.workspaceId, issueId: input.issueId }); } catch { return false; }
    ticket.context = context; ticket.key = key; ticket.pool = false; guest.key = key; guest.assignedAt = performance.now();
    console.info("[embedded-pool] assigned");
    guest.contents.send("embedded-pool:assigned", context);
    return true;
  });
  ipcMain.handle("embedded-guest:activate", async (event, token: unknown, preserve: unknown = []) => {
    const owner = ownerFor(event.sender); if (!owner || typeof token !== "string") return false;
    const guest = guests.get(token); if (!guest || guest.owner !== owner || guest.contents.isDestroyed()) return false;
    if (!Array.isArray(preserve) || preserve.some((value) => typeof value !== "string" || guests.get(value)?.owner !== owner || guests.get(value)?.contents.isDestroyed())) return false;
    const started = performance.now();
    const wasFrozen = guest.frozen;
    try {
      await enqueue(owner, async () => {
        await visibleSet(owner).show([...preserve, token]);
      });
      console.info("[embedded-guest] activated", JSON.stringify({ resumed: wasFrozen, durationMs: Math.round(performance.now() - started) }));
      return true;
    } catch (error) { console.error("Embedded guest activation failed", error); destroyGuest(token); return false; }
  });
  ipcMain.handle("embedded-guest:hide", async (event) => {
    const owner = ownerFor(event.sender); if (!owner) return;
    await enqueue(owner, async () => { await visibleSet(owner).show([]); });
  });
  ipcMain.handle("embedded-guest:show-surfaces", async (event, tokens: unknown) => {
    const owner = ownerFor(event.sender);
    if (!owner || !Array.isArray(tokens) || tokens.length > 3 || tokens.some((token) => typeof token !== "string" || guests.get(token)?.owner !== owner || guests.get(token)?.contents.isDestroyed())) return false;
    try { await enqueue(owner, async () => { await visibleSet(owner).show(tokens as string[]); }); return true; }
    catch (error) { console.error("Embedded surface activation failed", error); return false; }
  });
  ipcMain.handle("embedded-guest:remove", (event, token: unknown) => { const owner = ownerFor(event.sender); if (owner && typeof token === "string" && tickets.get(token)?.owner === owner) { destroyGuest(token); tickets.delete(token); } });
  ipcMain.handle("embedded-guest:presentation", (event, token: unknown, raw: unknown) => {
    const owner = ownerFor(event.sender), presentation = parseEmbeddedIssuePresentation(raw);
    if (!owner || typeof token !== "string" || !presentation) return false;
    const guest = guests.get(token), ticket = tickets.get(token);
    if (!guest || guest.owner !== owner || guest.contents.isDestroyed() || !ticket || ticket.userId !== options.userId(owner) || ticket.context.workspaceSlug !== options.workspaceSlug(owner)) return false;
    guest.contents.send("embedded-guest:presentation", presentation);
    return true;
  });
  ipcMain.on("embedded-guest:action", (event, action: unknown) => {
    const guest = byContents.get(event.sender);
    if (!guest || guest.owner.isDestroyed() || (action !== "done" && action !== "delete")) return;
    const entry = [...guests].find(([token, candidate]) => candidate === guest && active.get(guest.owner)?.has(token));
    if (entry) guest.owner.webContents.send("embedded-guest:action", { token: entry[0], action });
  });
  ipcMain.on("embedded-guest:ready", (event) => {
    const guest = byContents.get(event.sender); if (!guest || guest.owner.isDestroyed()) return;
    const token = [...guests].find(([, value]) => value === guest)?.[0];
    if (!token) return;
    void enqueue(guest.owner, async () => {
      if (guest.contents.isDestroyed() || !tickets.has(token)) return;
      if (!guest.contents.debugger.isAttached()) { guest.contents.debugger.attach("1.3"); await guest.contents.debugger.sendCommand("Page.enable"); }
      console.info("[embedded-guest] ready", JSON.stringify({ sinceAssignedMs: Math.round(performance.now() - guest.assignedAt) }));
      if (!active.get(guest.owner)?.has(token) && !guest.frozen) { await guest.contents.debugger.sendCommand("Page.setWebLifecycleState", { state: "frozen" }); guest.frozen = true; guest.frozenAt = performance.now(); }
      if (!guest.owner.isDestroyed()) guest.owner.webContents.send("embedded-guest:ready", token);
    }).catch((error) => { console.error("Embedded guest initialization failed", error); destroyGuest(token); });
  });
  ipcMain.on("embedded-issue:navigate", (event, raw: unknown) => {
    const guest = byContents.get(event.sender); if (!guest || ![...guests].some(([token, candidate]) => candidate === guest && active.get(guest.owner)?.has(token)) || !raw || typeof raw !== "object") return;
    const value = raw as { kind?: unknown; path?: unknown; replace?: unknown };
    if (value.kind === "back") { guest.owner.webContents.send("embedded-issue:navigation", { kind: "back" }); return; }
    if ((value.kind !== "shell" && value.kind !== "current-issue") || typeof value.path !== "string" || !value.path.startsWith("/") || value.path.startsWith("//") || value.path.includes("\\") || value.path.length > 2048) return;
    guest.owner.webContents.send("embedded-issue:navigation", { kind: value.kind, path: value.path, replace: value.replace === true });
  });
}
