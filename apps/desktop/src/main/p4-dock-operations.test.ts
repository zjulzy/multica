import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: [] as string[][], changed: false, action: "edit" }));
vi.mock("node:os", async (original) => { const actual = await original<typeof import("node:os")>(); return { ...actual, hostname: () => "MY-PC", default: { ...actual, hostname: () => "MY-PC" } }; });
vi.mock("node:fs/promises", async (original) => { const actual = await original<typeof import("node:fs/promises")>(); const fake = { ...actual, realpath: async (path: string) => path, stat: async () => ({ size: 12, isDirectory: () => true }), readFile: async () => "new content\n" }; return { ...fake, default: fake }; });
vi.mock("node:child_process", async (original) => { const actual = await original<typeof import("node:child_process")>(); const execFile = (_cmd: string, args: string[], _options: unknown, callback: (err: Error | null, out: { stdout: string; stderr: string }) => void) => {
  state.calls.push(args);
  let stdout = "";
  if (args.includes("info")) stdout = "... userName me\n";
  else if (args.includes("clients")) stdout = "... client local\n... Host MY-PC\n... Root D:\\Repo\n";
  else if (args.includes("changes")) stdout = "... change 123\n... client local\n... user me\n... desc ZGA-1 test\n";
  else if (args.includes("opened")) stdout = state.changed ? "" : `... depotFile //depot/file.cs\n... client local\n... change 123\n... action ${state.action}\n... haveRev 3\n... type text\n`;
  else if (args.includes("print")) stdout = "old content\n";
  else if (args.includes("client")) stdout = "... Client local\n... Root D:\\Repo\n";
  else if (args.includes("where")) stdout = "... depotFile //depot/file.cs\n... path D:\\Repo\\file.cs\n";
  callback(null, { stdout, stderr: "" });
}; return { ...actual, execFile, default: { ...actual, execFile } }; });
import { revertChangeFile, diffChangeFile } from "./p4-dock";

describe("P4 file operation guards", () => {
  beforeEach(() => { state.calls = []; state.changed = false; state.action = "edit"; });
  it("rejects a file no longer in the selected changelist without running revert", async () => {
    state.changed = true;
    await expect(revertChangeFile(["ZGA-1"], "local", "123", "//depot/file.cs")).rejects.toThrow(/no longer belongs/);
    expect(state.calls.some((args) => args.includes("revert"))).toBe(false);
  });
  it("rejects wildcard-like paths before asking P4 to diff", async () => {
    await expect(diffChangeFile(["ZGA-1"], "local", "123", "//depot/...")).rejects.toThrow(/Invalid P4 file/);
    expect(state.calls).toHaveLength(0);
  });
  it("passes the confirmed single file and changelist as separate arguments", async () => {
    await revertChangeFile(["ZGA-1"], "local", "123", "//depot/file.cs");
    expect(state.calls.at(-1)).toEqual(["-c", "local", "revert", "-c", "123", "//depot/file.cs"]);
  });
  it("shows deleted text against the checked-out base revision", async () => {
    state.action = "delete";
    expect(await diffChangeFile(["ZGA-1"], "local", "123", "//depot/file.cs")).toContain("-old content");
    expect(state.calls.at(-1)).toEqual(["-c", "local", "print", "-q", "//depot/file.cs#3"]);
  });
  it("shows added text from the verified local workspace", async () => {
    state.action = "add";
    expect(await diffChangeFile(["ZGA-1"], "local", "123", "//depot/file.cs")).toContain("+new content");
  });
  it("never reverts a moved file, which P4 would revert together with its pair", async () => {
    state.action = "move/add";
    await expect(revertChangeFile(["ZGA-1"], "local", "123", "//depot/file.cs")).rejects.toThrow(/reverted as a pair/);
    expect(state.calls.some((args) => args.includes("revert"))).toBe(false);
  });
});
