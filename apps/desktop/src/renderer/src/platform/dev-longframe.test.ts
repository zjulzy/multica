import { describe, expect, it } from "vitest";
import { summarizeLongFrame, summarizeDockFrame } from "./dev-longframe";

describe("development long-frame diagnostics", () => {
  it("summarizes dock frame phases without exposing page content", () => {
    expect(summarizeDockFrame({ duration: 180, startTime: 100, renderStart: 210, styleAndLayoutStart: 240, scripts: [{ duration: 80, forcedStyleAndLayoutDuration: 30 }] }, 90)).toEqual({
      kind: "dock-long-frame", sinceClickMs: 10, durationMs: 180, beforeRenderMs: 110, beforeLayoutMs: 30, layoutAndPaintMs: 40, scriptMs: 80, forcedLayoutMs: 30,
    });
  });
  it("reports timings and local script names without external URLs", () => {
    const result = summarizeLongFrame({ duration: 321, scripts: [
      { duration: 210, sourceURL: "http://localhost:5173/src/issue-detail.tsx?token=private", sourceFunctionName: "render" },
      { duration: 50, sourceURL: "https://example.test/private.js", sourceFunctionName: "work" },
    ] });
    expect(result).toEqual({ kind: "long-frame-global", durationMs: 321, scripts: [
      { source: "issue-detail.tsx", function: "render", durationMs: 210 },
      { source: "other", function: "work", durationMs: 50 },
    ] });
  });
});
