import { useLayoutEffect, type RefObject } from "react";

/** Align the single-tab title to the visible page pane, including live sidebar resizes. */
export function useHeaderAlignment(headerRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const header = headerRef.current;
    const parent = header?.parentElement;
    const card = document.querySelector<HTMLElement>('[data-slot="desktop-content-card"]');
    if (!header || !parent || !card) return;

    let target: HTMLElement | null = null;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; update(); });
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    const findTarget = () => card.querySelector<HTMLElement>('[data-slot="desktop-list-page"] [data-slot="list-page-main"]') ?? card;
    const update = () => {
      const nextTarget = findTarget();
      if (nextTarget !== target) {
        resizeObserver?.disconnect();
        target = nextTarget;
        resizeObserver?.observe(parent);
        resizeObserver?.observe(card);
        if (target !== card) resizeObserver?.observe(target);
      }
      const parentRect = parent.getBoundingClientRect();
      const targetRect = nextTarget.getBoundingClientRect();
      const offset = Math.max(0, Math.min(targetRect.left - parentRect.left, parentRect.width - 160));
      const margin = `${Math.round(offset)}px`;
      if (header.style.marginLeft !== margin) header.style.marginLeft = margin;
    };
    const mutations = new MutationObserver((records) => {
      const paneAdded = records.some((record) => Array.from(record.addedNodes).some((node) =>
        node instanceof Element && (node.matches('[data-slot="list-page-main"]') || node.querySelector('[data-slot="list-page-main"]')),
      ));
      if ((target && !target.isConnected) || paneAdded) {
        if (findTarget() !== target) schedule();
      }
    });
    mutations.observe(card, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      resizeObserver?.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      header.style.removeProperty("margin-left");
    };
  }, [headerRef]);
}
