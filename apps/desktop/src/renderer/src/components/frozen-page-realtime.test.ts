import { describe, expect, it, vi } from "vitest";
import { FrozenPageLifecycle } from "./frozen-page-lifecycle";
import { frozenRealtime } from "./frozen-page-realtime";

describe("frozen issue realtime", () => {
  it("disconnects page subscriptions while hidden and resubscribes on return", () => {
    const unsubscribe = vi.fn();
    const disconnectReconnect = vi.fn();
    const ws = { subscribe: vi.fn(() => unsubscribe), onReconnect: vi.fn(() => disconnectReconnect) };
    const lifecycle = new FrozenPageLifecycle();
    const gated = frozenRealtime(ws, lifecycle);
    const handler = vi.fn();
    const reconnect = vi.fn();
    const untrack = gated.subscribe("comment:created", handler);
    const untrackReconnect = gated.onReconnect(reconnect);
    expect(ws.subscribe).toHaveBeenCalledTimes(1);
    lifecycle.setVisible(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(disconnectReconnect).toHaveBeenCalledTimes(1);
    lifecycle.setVisible(true);
    expect(ws.subscribe).toHaveBeenCalledTimes(2);
    expect(ws.onReconnect).toHaveBeenCalledTimes(2);
    untrack(); untrackReconnect();
    lifecycle.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(disconnectReconnect).toHaveBeenCalledTimes(2);
  });
});
