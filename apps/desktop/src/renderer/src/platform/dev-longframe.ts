type ScriptTiming = { sourceURL?: string; sourceFunctionName?: string; sourceCharPosition?: number; duration: number; forcedStyleAndLayoutDuration?: number };
type LongFrame = { duration: number; startTime?: number; renderStart?: number; styleAndLayoutStart?: number; scripts?: ScriptTiming[] };

export function summarizeDockFrame(entry: LongFrame, clickedAt: number) {
  const start = entry.startTime ?? 0;
  const render = entry.renderStart || start + entry.duration;
  const layout = entry.styleAndLayoutStart || render;
  return {
    kind: "dock-long-frame", sinceClickMs: Math.round(start - clickedAt), durationMs: Math.round(entry.duration),
    beforeRenderMs: Math.round(render - start), beforeLayoutMs: Math.round(layout - render),
    layoutAndPaintMs: Math.round(Math.max(0, start + entry.duration - layout)),
    scriptMs: Math.round((entry.scripts ?? []).reduce((sum, script) => sum + script.duration, 0)),
    forcedLayoutMs: Math.round((entry.scripts ?? []).reduce((sum, script) => sum + (script.forcedStyleAndLayoutDuration ?? 0), 0)),
  };
}

export function summarizeLongFrame(entry: LongFrame) {
  const scripts = (entry.scripts ?? []).filter((script) => script.duration >= 10).map((script) => {
    const source = script.sourceURL ?? "";
    const local = source.startsWith("http://localhost:5173/") || source.startsWith("file:");
    return {
      source: local ? (source.split("?")[0]?.split("/").at(-1) ?? "local") : "other",
      function: (script.sourceFunctionName ?? "").replace(/[^\w.$<>-]/g, "").slice(0, 80),
      ...(script.sourceCharPosition !== undefined ? { offset: script.sourceCharPosition } : {}),
      durationMs: Math.round(script.duration),
    };
  }).sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
  return { kind: "long-frame-global", durationMs: Math.round(entry.duration), scripts };
}

export function observeDevelopmentLongFrames() {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame")) return;
  let lastDockClick = -Infinity;
  if (import.meta.env.VITE_DOCK_PERF === "1") document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest?.('[data-testid="dock-inbox-content"] button[aria-expanded]');
    if (!button) return;
    lastDockClick = performance.now();
    const clickedAt = lastDockClick;
    console.info("[issue-load-performance]", JSON.stringify({ kind: "dock-click", expanded: button.getAttribute("aria-expanded") === "true", elements: document.getElementsByTagName("*").length }));
    let previous = clickedAt;
    let frames = 0;
    let slowFrames = 0;
    let maxFrameMs = 0;
    const tick = (now: number) => {
      if (lastDockClick !== clickedAt) return;
      const delta = now - previous;
      previous = now;
      frames++;
      if (delta > 50) slowFrames++;
      maxFrameMs = Math.max(maxFrameMs, delta);
      if (now - clickedAt < 700) requestAnimationFrame(tick);
      else console.info("[issue-load-performance]", JSON.stringify({ kind: "dock-frames", frames, slowFrames, maxFrameMs: Math.round(maxFrameMs) }));
    };
    requestAnimationFrame(tick);
  }, true);
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.startTime >= lastDockClick && entry.startTime - lastDockClick < 1000 && entry.duration >= 50) console.info("[issue-load-performance]", JSON.stringify(summarizeDockFrame(entry as PerformanceEntry & LongFrame, lastDockClick)));
      if (entry.duration >= 100) console.info("[issue-load-performance]", JSON.stringify(summarizeLongFrame(entry as PerformanceEntry & LongFrame)));
    }
  });
  observer.observe({ type: "long-animation-frame" });
}
