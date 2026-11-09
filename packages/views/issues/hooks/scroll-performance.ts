import { useEffect } from "react";
import { takeIssueRenderSummary } from "./issue-render-profile";

export function summarizeScrollFrames(frames: number[], longTasks: number[]) {
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    frames: sorted.length,
    slowFrames: sorted.filter((ms) => ms >= 50).length,
    maxFrameMs: Math.round(sorted.at(-1) ?? 0),
    p95FrameMs: Math.round(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0),
    longTasks: longTasks.length,
    maxLongTaskMs: Math.round(Math.max(0, ...longTasks)),
  };
}

export function summarizeIssueDom(element: HTMLElement) {
  const blocks = Array.from(element.querySelectorAll<HTMLElement>("[data-comment-block]"));
  const folded = blocks.filter((block) => block.querySelector("[data-reply-fold-id]"));
  const actions = Array.from(element.querySelectorAll<HTMLElement>("[data-comment-actions]"));
  const countSubtree = (items: HTMLElement[]) => items.reduce((total, item) => total + 1 + item.querySelectorAll("*").length, 0);
  return { renderedElements: element.querySelectorAll("*").length, renderedCommentBlocks: blocks.length,
    renderedCommentActions: actions.length, foldedCommentBlocks: folded.length,
    foldedCommentElements: countSubtree(folded), commentActionElements: countSubtree(actions) };
}

/** Development-only, active only during and briefly after user scrolling. */
export function useIssueScrollPerformance(element: HTMLElement | null) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !element) return;
    let frames: number[] = [];
    let longTasks: number[] = [];
    let frame = 0;
    let timer = 0;
    let previous = 0;
    let lastScroll = 0;
    let observer: PerformanceObserver | undefined;
    let frameObserver: PerformanceObserver | undefined;
    const sample = (timestamp: number) => {
      if (previous && timestamp - lastScroll < 200) frames.push(timestamp - previous);
      previous = timestamp;
      frame = requestAnimationFrame(sample);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      observer = undefined;
      frameObserver?.disconnect();
      frameObserver = undefined;
      if (frames.length) console.info("[issue-load-performance]", JSON.stringify({ kind: "scroll", ...summarizeScrollFrames(frames, longTasks),
        ...summarizeIssueDom(element),
        reactRender: takeIssueRenderSummary() }));
      frames = [];
      longTasks = [];
      previous = 0;
    };
    const onScroll = () => {
      lastScroll = performance.now();
      if (!frame) {
        takeIssueRenderSummary();
        if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
          observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) longTasks.push(entry.duration); });
          observer.observe({ entryTypes: ["longtask"] });
        }
        if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) {
          frameObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const detailed = entry as PerformanceEntry & { scripts?: Array<{ sourceURL?: string; sourceFunctionName?: string; duration: number }> };
              const scripts = (detailed.scripts ?? []).filter((script) => script.duration >= 10).map((script) => {
                const source = script.sourceURL ?? "";
                const local = source.startsWith("http://localhost:5173/") || source.startsWith("file:");
                return { source: local ? (source.split("?")[0]?.split("/").at(-1) ?? "local") : "other", function: (script.sourceFunctionName ?? "").replace(/[^\w.$<>-]/g, "").slice(0, 80), durationMs: Math.round(script.duration) };
              }).sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
              console.info("[issue-load-performance]", JSON.stringify({ kind: "long-frame", durationMs: Math.round(entry.duration), scripts }));
            }
          });
          frameObserver.observe({ type: "long-animation-frame" });
        }
        frame = requestAnimationFrame(sample);
      }
      clearTimeout(timer);
      timer = window.setTimeout(stop, 800);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
      if (frame) stop();
    };
  }, [element]);
}
