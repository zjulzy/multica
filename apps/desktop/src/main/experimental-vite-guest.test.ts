import { describe, expect, it } from "vitest";
import { patchViteClientForFrozenGuest } from "./experimental-vite-guest";

describe("experimental guest Vite client", () => {
  it("reconnects a frozen guest without reloading it, preserving normal window behavior", () => {
    const source = "await waitForSuccessfulPing(url.href);\n\t\t\t\t\tlocation.reload();";
    const patched = patchViteClientForFrozenGuest(source);
    expect(patched).toContain("globalThis.desktopAPI?.isEmbeddedIssue");
    expect(patched).toContain("transport.connect(createHMRHandler(handleMessage))");
    expect(patched).toContain("else location.reload()");
  });

  it("fails explicitly if the upstream disconnect handler changes", () => {
    expect(() => patchViteClientForFrozenGuest("unknown vite client")).toThrow();
  });
});
