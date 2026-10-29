// @vitest-environment node
import { describe, expect, it } from "vitest";
import { devProtocolArguments, devAppSuffix } from "./dev-protocol";

describe("development protocol callback", () => {
  it("preserves the worktree identity when Windows launches a callback without the parent environment", () => {
    const args = devProtocolArguments("E:\\app", "inbox-dock-223");
    expect(devAppSuffix(undefined, ["electron.exe", ...args, "multica://auth/callback"])).toBe("inbox-dock-223");
  });

  it("keeps the normal development profile when no suffix is configured", () => {
    expect(devProtocolArguments("E:\\app", undefined)).toEqual(["E:\\app"]);
    expect(devAppSuffix(undefined, ["electron.exe", "E:\\app"])).toBeUndefined();
  });
});
