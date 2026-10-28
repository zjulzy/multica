import { beforeEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore, isSingleTabMode } from "./desktop-prefs-store";

beforeEach(() => {
  localStorage.clear();
  useDesktopPrefsStore.setState({
    singleTabMode: false,
    inboxDockEnabled: false,
    inboxDockOpen: false,
    inboxDockSize: 38,
  });
});

describe("desktop prefs store", () => {
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
});
