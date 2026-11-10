import { beforeEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore, isSingleTabMode } from "./desktop-prefs-store";

beforeEach(() => {
  localStorage.clear();
  useDesktopPrefsStore.setState({
    singleTabMode: false,
    inboxDockEnabled: false,
    inboxDockOpen: false,
    inboxDockSize: 38,
    agentStatusHubEnabled: true,
  });
});

describe("desktop prefs store", () => {
  it("migrates and persists a bounded lightweight inbox reply limit", async () => {
    localStorage.setItem("multica_desktop_prefs", JSON.stringify({ state: {}, version: 9 }));
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().lightweightInboxReplyLimit).toBe(6);
    useDesktopPrefsStore.getState().setLightweightInboxReplyLimit(12);
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().lightweightInboxReplyLimit).toBe(12);
    useDesktopPrefsStore.getState().setLightweightInboxReplyLimit(100);
    expect(useDesktopPrefsStore.getState().lightweightInboxReplyLimit).toBe(50);
  });
  it("enables the lightweight inbox for existing preferences and persists disabling it", async () => {
    localStorage.setItem("multica_desktop_prefs", JSON.stringify({ state: {}, version: 8 }));
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().lightweightInboxEnabled).toBe(true);
    useDesktopPrefsStore.getState().setLightweightInboxEnabled(false);
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().lightweightInboxEnabled).toBe(false);
  });
  it("enables pinned issue caching for existing preferences and persists changes", async () => {
    localStorage.setItem("multica_desktop_prefs", JSON.stringify({ state: { singleTabMode: true }, version: 7 }));
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().pinnedIssueCacheEnabled).toBe(true);
    useDesktopPrefsStore.getState().setPinnedIssueCacheEnabled(false);
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().pinnedIssueCacheEnabled).toBe(false);
  });
  it("defaults singleTabMode to false", () => {
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(false);
    expect(isSingleTabMode()).toBe(false);
  });

  it("toggles and persists under multica_desktop_prefs", () => {
    useDesktopPrefsStore.getState().setSingleTabMode(true);
    expect(isSingleTabMode()).toBe(true);
    const raw = JSON.parse(localStorage.getItem("multica_desktop_prefs") ?? "{}");
    expect(raw.state.singleTabMode).toBe(true);
  });

  it("defaults the Inbox dock to disabled and collapsed", () => {
    const state = useDesktopPrefsStore.getState();

    expect(state.inboxDockEnabled).toBe(false);
    expect(state.inboxDockOpen).toBe(false);
    expect(state.inboxDockSize).toBe(38);
  });

  it("persists the Inbox dock enable and open preferences", () => {
    useDesktopPrefsStore.getState().setInboxDockEnabled(true);
    useDesktopPrefsStore.getState().setInboxDockOpen(true);
    useDesktopPrefsStore.getState().setInboxDockSize(57);

    let raw = JSON.parse(localStorage.getItem("multica_desktop_prefs") ?? "{}");
    expect(raw.state.inboxDockEnabled).toBe(true);
    expect(raw.state.inboxDockOpen).toBe(true);
    expect(raw.state.inboxDockSize).toBe(57);

    useDesktopPrefsStore.getState().setInboxDockEnabled(false);

    expect(useDesktopPrefsStore.getState().inboxDockOpen).toBe(false);
    raw = JSON.parse(localStorage.getItem("multica_desktop_prefs") ?? "{}");
    expect(raw.state.inboxDockEnabled).toBe(false);
    expect(raw.state.inboxDockOpen).toBe(false);
  });

  it("preserves false defaults when rehydrating version 1 preferences", async () => {
    localStorage.setItem(
      "multica_desktop_prefs",
      JSON.stringify({ state: { singleTabMode: true }, version: 1 }),
    );

    await useDesktopPrefsStore.persist.rehydrate();

    const state = useDesktopPrefsStore.getState();
    expect(state.singleTabMode).toBe(true);
    expect(state.inboxDockEnabled).toBe(false);
    expect(state.inboxDockOpen).toBe(false);
    expect(state.inboxDockSize).toBe(38);
  });

  it("defaults the agent status hub to enabled and preserves old version 3 preferences", async () => {
    localStorage.setItem("multica_desktop_prefs", JSON.stringify({
      state: { singleTabMode: true, inboxDockEnabled: true, inboxDockOpen: true, inboxDockSize: 55 },
      version: 3,
    }));
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(true);
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(true);
    expect(useDesktopPrefsStore.getState().inboxDockSize).toBe(55);
  });

  it("persists disabling and re-enabling the agent status hub", async () => {
    useDesktopPrefsStore.getState().setAgentStatusHubEnabled(false);
    expect(JSON.parse(localStorage.getItem("multica_desktop_prefs") ?? "{}").state.agentStatusHubEnabled).toBe(false);
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(false);
    useDesktopPrefsStore.getState().setAgentStatusHubEnabled(true);
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(true);
  });

  it("defaults interface motion to off when upgrading and persists changes independently", async () => {
    localStorage.setItem("multica_desktop_prefs", JSON.stringify({
      state: { singleTabMode: true, agentStatusHubEnabled: false }, version: 4,
    }));
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().interfaceMotionEnabled).toBe(false);
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(true);
    expect(useDesktopPrefsStore.getState().agentStatusHubEnabled).toBe(false);
    useDesktopPrefsStore.getState().setInterfaceMotionEnabled(true);
    await useDesktopPrefsStore.persist.rehydrate();
    expect(useDesktopPrefsStore.getState().interfaceMotionEnabled).toBe(true);
  });
});
