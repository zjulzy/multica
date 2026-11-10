import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, matches: true }));
vi.mock("@/stores/desktop-prefs-store", () => ({ useDesktopPrefsStore: (selector: (value: any) => unknown) => selector({ meegoSyncEnabled: state.enabled }) }));
vi.mock("@multica/views/i18n", () => ({ useLocale: () => "zh-Hans" }));
vi.mock("@multica/views/navigation", () => ({ useNavigation: () => ({ pathname: "/zgame/issues" }), AppLink: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@multica/views/layout", () => ({ PanelLink: ({ href, label }: any) => <a href={href}>{label}</a> }));
vi.mock("./meego-sync-hooks", () => ({ useMeegoSync: () => ({ workspace: { slug: "zgame" }, matches: state.matches }) }));
import { MeegoSyncNav } from "./meego-sync-nav";
beforeEach(() => { state.enabled = true; state.matches = true; });
describe("Meego sync navigation", () => {
  it("links to the native page only for a matching service workspace", () => {
    const view = render(<MeegoSyncNav />);
    expect(screen.getByRole("link", { name: "Meego 同步" })).toHaveAttribute("href", "/zgame/meego-sync");
    state.matches = false; view.rerender(<MeegoSyncNav />);
    expect(screen.queryByRole("link", { name: "Meego 同步" })).toBeNull();
  });
  it("renders as a compact rail item", () => {
    render(<MeegoSyncNav />);
    expect(screen.getByRole("link", { name: "Meego 同步" }).closest("li")).not.toBeNull();
  });
  it("respects the entry switch", () => { state.enabled = false; render(<MeegoSyncNav />); expect(screen.queryByRole("link", { name: "Meego 同步" })).toBeNull(); });
});
