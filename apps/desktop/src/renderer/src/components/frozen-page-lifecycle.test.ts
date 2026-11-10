import { describe, expect, it, vi } from "vitest";
import { FrozenPageLifecycle } from "./frozen-page-lifecycle";

describe("frozen issue lifecycle", () => {
  it("pauses page-owned subscriptions while hidden and restores each only once", () => {
    const start = vi.fn(() => vi.fn());
    const lifecycle = new FrozenPageLifecycle();
    const unregister = lifecycle.track(start);
    expect(start).toHaveBeenCalledTimes(1);
    const stop = start.mock.results[0]!.value;
    lifecycle.setVisible(false);
    lifecycle.setVisible(false);
    expect(stop).toHaveBeenCalledTimes(1);
    lifecycle.setVisible(true);
    lifecycle.setVisible(true);
    expect(start).toHaveBeenCalledTimes(2);
    unregister();
    expect(start.mock.results[1]!.value).toHaveBeenCalledTimes(1);
    lifecycle.setVisible(false);
    lifecycle.setVisible(true);
    expect(start).toHaveBeenCalledTimes(2);
  });
  it("does not start a registration while hidden and releases everything on dispose", () => {
    const lifecycle = new FrozenPageLifecycle();
    lifecycle.setVisible(false);
    const start = vi.fn(() => vi.fn());
    lifecycle.track(start);
    expect(start).not.toHaveBeenCalled();
    lifecycle.setVisible(true);
    expect(start).toHaveBeenCalledTimes(1);
    lifecycle.dispose();
    expect(start.mock.results[0]!.value).toHaveBeenCalledTimes(1);
    lifecycle.setVisible(true);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
