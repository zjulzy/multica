import { useCallback, useEffect, useRef } from "react";

/** Allow late-loaded timeline content a short period to settle after a jump. */
export const JUMP_FOLLOW_MS = 2000;
const CORRECTION_INTERVAL_MS = 120;

export function useJumpToLatest(scrollContainerEl: HTMLElement | null) {
  const cancelJumpRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelJumpRef.current?.(), [scrollContainerEl]);

  const jump = useCallback(() => {
    const el = scrollContainerEl;
    if (!el) return;
    cancelJumpRef.current?.();
    let stopped = false;
    let correction: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let observer: ResizeObserver | undefined;
    const inputs = ["wheel", "touchstart", "pointerdown"] as const;
    const doc = el.ownerDocument;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (correction !== undefined) clearTimeout(correction);
      if (deadline !== undefined) clearTimeout(deadline);
      observer?.disconnect();
      for (const type of inputs) el.removeEventListener(type, stop);
      doc.removeEventListener("keydown", stop, true);
      if (cancelJumpRef.current === stop) cancelJumpRef.current = null;
    };
    const toBottom = () => {
      if (!el.isConnected) { stop(); return; }
      const target = Math.max(0, el.scrollHeight - el.clientHeight);
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    };
    for (const type of inputs) el.addEventListener(type, stop, { passive: true });
    doc.addEventListener("keydown", stop, { capture: true, passive: true });
    cancelJumpRef.current = stop;
    toBottom();
    if (stopped) return;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (correction !== undefined || stopped) return;
        correction = setTimeout(() => { correction = undefined; toBottom(); }, CORRECTION_INTERVAL_MS);
      });
      observer.observe(el);
      for (const child of Array.from(el.children)) observer.observe(child);
    }
    deadline = setTimeout(stop, JUMP_FOLLOW_MS);
  }, [scrollContainerEl]);

  return { visible: !!scrollContainerEl, jump };
}
