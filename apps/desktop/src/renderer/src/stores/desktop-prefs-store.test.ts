import { beforeEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore, isSingleTabMode } from "./desktop-prefs-store";

beforeEach(() => {
  localStorage.clear();
  useDesktopPrefsStore.setState({ singleTabMode: false });
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
});
