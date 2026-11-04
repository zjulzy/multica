import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useAutopilotsViewStore } from "@multica/core/autopilots/stores";
import type { Autopilot } from "@multica/core/types";
import { NavigationProvider, type NavigationAdapter } from "../../navigation";
import { renderWithI18n } from "../../test/i18n";
import { AutopilotsPanel } from "./autopilots-panel";
import { PersistentPinsProvider } from "../persistent-pins-context";

vi.mock("./shared-pinned-section", () => ({ SharedPinnedSection: () => <section data-testid="shared-pins">Pinned</section> }));

vi.mock("@multica/core/api", () => ({
  api: { listAutopilots: vi.fn(), listWorkspaceWakeups: vi.fn() },
}));
vi.mock("@multica/core/paths", () => ({
  useCurrentWorkspace: () => ({ id: "ws" }),
  useWorkspacePaths: () => ({
    autopilots: () => "/ws/autopilots",
    autopilotDetail: (id: string) => `/ws/autopilots/${id}`,
  }),
}));

function autopilot(id: string, title: string, status: Autopilot["status"]): Autopilot {
  return { id, title, status, trigger_kinds: ["schedule"] } as unknown as Autopilot;
}

function mount(path: string, push = vi.fn(), persistentPins = false) {
  const url = new URL(path, "https://example.test");
  const adapter: NavigationAdapter = {
    pathname: url.pathname,
    searchParams: url.searchParams,
    hash: "",
    push,
    replace: vi.fn(),
    back: vi.fn(),
    getShareableUrl: (p) => p,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithI18n(
    <QueryClientProvider client={client}>
      <NavigationProvider value={adapter}>
        {persistentPins ? <PersistentPinsProvider><AutopilotsPanel /></PersistentPinsProvider> : <AutopilotsPanel />}
      </NavigationProvider>
    </QueryClientProvider>,
  );
}

const allRow = () => screen.getByRole("link", { name: /^All autopilots/ });
const wakeupsRow = () => screen.getByRole("link", { name: /^Issue wakeups/ });

beforeEach(() => {
  useAutopilotsViewStore.setState({ scope: "all" });
  vi.mocked(api.listAutopilots).mockReset().mockResolvedValue({
    autopilots: [
      autopilot("a1", "Daily sync", "active"),
      autopilot("a2", "Weekly report", "paused"),
      autopilot("a3", "Old digest", "archived"),
    ],
    total: 3,
  });
  vi.mocked(api.listWorkspaceWakeups).mockReset().mockResolvedValue({
    items: [],
    total: 0,
    counts: { all: 9, active: 5, paused: 1, disabled: 2, ended: 1 },
    agents: [],
  });
});

describe("AutopilotsPanel", () => {
  it("places pins within the same scrolling navigation as the automation links", () => {
    mount("/ws/autopilots", vi.fn(), true);
    const pins = screen.getByTestId("shared-pins");
    expect(pins.closest(".overflow-y-auto")).toContainElement(allRow());
  });
  it("links the list and the wakeups with their counts, the list active", async () => {
    mount("/ws/autopilots");
    await within(allRow()).findByText("2");
    expect(screen.queryByRole("link", { name: /Daily sync/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Weekly report/ })).not.toBeInTheDocument();

    expect(allRow()).toHaveAttribute("href", "/ws/autopilots");
    expect(allRow()).toHaveAttribute("aria-current", "page");
    expect(within(allRow()).getByText("2")).toBeInTheDocument();

    expect(wakeupsRow()).toHaveAttribute("href", "/ws/autopilots?tab=wakeups");
    expect(wakeupsRow()).not.toHaveAttribute("aria-current");
    expect(await within(wakeupsRow()).findByText("5")).toBeInTheDocument();
  });

  it("marks only the wakeups row on ?tab=wakeups", async () => {
    mount("/ws/autopilots?tab=wakeups");
    await within(allRow()).findByText("2");

    expect(wakeupsRow()).toHaveAttribute("aria-current", "page");
    expect(allRow()).not.toHaveAttribute("aria-current");
  });

  it("leaves both top rows inactive on an autopilot's page", async () => {
    mount("/ws/autopilots/a1");
    await within(allRow()).findByText("2");
    expect(allRow()).not.toHaveAttribute("aria-current");
    expect(wakeupsRow()).not.toHaveAttribute("aria-current");
  });

  it("opens the list on its full scope", async () => {
    useAutopilotsViewStore.setState({ scope: "paused" });
    const push = vi.fn();
    mount("/ws/autopilots?tab=wakeups", push);
    await within(allRow()).findByText("2");

    fireEvent.click(allRow());
    expect(useAutopilotsViewStore.getState().scope).toBe("all");
    expect(push).toHaveBeenCalledWith("/ws/autopilots");
  });
});
