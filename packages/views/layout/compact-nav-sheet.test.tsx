import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithI18n } from "../test/i18n";
import { fireEvent, screen } from "@testing-library/react";
import { CompactNavSheet } from "./compact-nav-sheet";
import { PersistentPinsProvider } from "./persistent-pins-context";

const state = vi.hoisted(() => ({
  pathname: "/acme/issues",
  isCompact: true,
  openMobile: false,
  setOpenMobile: vi.fn(),
  hasPanel: true,
}));

vi.mock("../navigation", () => ({
  useNavigation: () => ({ pathname: state.pathname }),
}));
vi.mock("@multica/ui/components/ui/sidebar", () => ({
  useSidebar: () => ({
    isCompact: state.isCompact,
    openMobile: state.openMobile,
    setOpenMobile: state.setOpenMobile,
  }),
}));
vi.mock("./app-rail", () => ({ AppRail: ({ bottomSlot }: { bottomSlot?: React.ReactNode }) => <nav data-testid="rail">{bottomSlot}</nav> }));
vi.mock("./space-panel", () => ({
  SpacePanelContent: ({ space }: { space: string | null }) => <div data-testid={`panel-${space}`} />,
}));
vi.mock("./app-shell-context", () => ({
  useAppShell: () => ({ space: "work", hasPanel: state.hasPanel }),
}));
vi.mock("./panels/shared-pinned-section", () => ({ SharedPinnedSection: () => <div data-testid="shared-pins" /> }));

beforeEach(() => {
  state.pathname = "/acme/issues";
  state.isCompact = true;
  state.openMobile = false;
  state.hasPanel = true;
  state.setOpenMobile.mockClear();
});

// The sheet covers the page on a phone: a tap that navigates but leaves it
// open renders the destination underneath and reads as a dead tap.
describe("CompactNavSheet dismissal", () => {
  it("dismisses the sheet once the route changes", () => {
    const { rerender } = renderWithI18n(<CompactNavSheet />);
    state.setOpenMobile.mockClear();

    state.pathname = "/acme/inbox";
    rerender(<CompactNavSheet />);
    expect(state.setOpenMobile).toHaveBeenCalledWith(false);
  });

  it("does not re-dismiss while the route holds still", () => {
    const { rerender } = renderWithI18n(<CompactNavSheet />);
    state.setOpenMobile.mockClear();

    rerender(<CompactNavSheet />);
    expect(state.setOpenMobile).not.toHaveBeenCalled();
  });
});

describe("CompactNavSheet content", () => {
  it("shows pins in the compact sheet on pages without their own panel", () => {
    state.openMobile = true;
    state.hasPanel = false;
    renderWithI18n(<PersistentPinsProvider><CompactNavSheet /></PersistentPinsProvider>);
    expect(screen.getByTestId("shared-pins")).toBeInTheDocument();
  });
  it("closes the sheet when an agent hub action opens the dock without changing the route", () => {
    state.openMobile = true;
    const openDock = vi.fn();
    renderWithI18n(<CompactNavSheet bottomSlot={<button onClick={openDock}>Agent</button>} />);
    state.setOpenMobile.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    expect(openDock).toHaveBeenCalledOnce();
    expect(state.setOpenMobile).toHaveBeenCalledWith(false);
  });
  it("holds the rail and the current space's panel", () => {
    state.openMobile = true;
    const { getByTestId } = renderWithI18n(<CompactNavSheet />);
    expect(getByTestId("rail")).toBeInTheDocument();
    expect(getByTestId("panel-work")).toBeInTheDocument();
  });

  it("renders nothing above the compact breakpoint", () => {
    state.isCompact = false;
    state.openMobile = true;
    const { queryByTestId } = renderWithI18n(<CompactNavSheet />);
    expect(queryByTestId("rail")).toBeNull();
  });
});
