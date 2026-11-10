// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("../search-index/hooks", () => ({ useLocalSearchIndexSync: calls.sync }));
vi.mock("./use-realtime-sync", () => ({ useRealtimeSync: () => {} }));
vi.mock("../platform/workspace-storage", () => ({ getCurrentSlug: () => null, getCurrentWsId: () => null, subscribeToCurrentSlug: () => () => {} }));
import { WSProvider } from "./provider";

const authStore = ((select: (state: { user: null }) => unknown) => select({ user: null })) as never;
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

describe("realtime local search index ownership", () => {
  it("starts indexing in a normal window but not in an embedded issue", () => {
    calls.sync.mockClear();
    const view = render(<WSProvider wsUrl="ws://localhost" authStore={authStore} storage={storage}><div /></WSProvider>);
    expect(calls.sync).toHaveBeenCalled();
    view.unmount();
    calls.sync.mockClear();
    render(<WSProvider wsUrl="ws://localhost" authStore={authStore} storage={storage} enableLocalSearchIndex={false}><div /></WSProvider>);
    expect(calls.sync).not.toHaveBeenCalled();
  });
});
