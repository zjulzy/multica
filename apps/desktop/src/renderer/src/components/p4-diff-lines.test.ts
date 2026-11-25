import { describe, expect, it } from "vitest";
import { parseP4Diff } from "./p4-diff-lines";

describe("P4 unified diff", () => {
  it("retains hunk boundaries and assigns both original and new line numbers", () => {
    const lines = parseP4Diff("--- old\n+++ new\n@@ -12,2 +12,3 @@ section\n same\n-old\n+new\n+extra\n");
    expect(lines).toEqual([
      { kind: "hunk", text: "@@ -12,2 +12,3 @@ section" },
      { kind: "context", oldLine: 12, newLine: 12, text: "same" },
      { kind: "remove", oldLine: 13, newLine: null, text: "old" },
      { kind: "add", oldLine: null, newLine: 13, text: "new" },
      { kind: "add", oldLine: null, newLine: 14, text: "extra" },
    ]);
  });
  it("numbers synthetic added and deleted files without a hunk header", () => {
    expect(parseP4Diff("--- /dev/null\n+++ file\n+one\n+two")).toEqual([
      { kind: "add", oldLine: null, newLine: 1, text: "one" },
      { kind: "add", oldLine: null, newLine: 2, text: "two" },
    ]);
    expect(parseP4Diff("--- file\n+++ /dev/null\n-old")).toEqual([{ kind: "remove", oldLine: 1, newLine: null, text: "old" }]);
  });
  it("retains non-diff status messages", () => {
    expect(parseP4Diff("二进制文件不支持文本 Diff。" )).toEqual([{ kind: "message", text: "二进制文件不支持文本 Diff。" }]);
  });
  it("does not discard added source lines that look like a diff header", () => {
    expect(parseP4Diff("--- /dev/null\n+++ file\n+++ value")).toEqual([{ kind: "add", oldLine: null, newLine: 1, text: "++ value" }]);
  });
});
