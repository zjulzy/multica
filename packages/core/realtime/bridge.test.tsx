// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWSEvent } from "./hooks";
import { WSContextBridge } from "./provider";

describe("websocket context bridge", () => {
  it("reuses the existing subscription source and cleans up without opening a connection", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const onReconnect = vi.fn(() => vi.fn());
    function Probe() { useWSEvent("comment:created", () => {}); return null; }
    const { unmount } = render(<WSContextBridge value={{ subscribe, onReconnect }}><Probe /></WSContextBridge>);
    expect(subscribe).toHaveBeenCalledWith("comment:created", expect.any(Function));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
