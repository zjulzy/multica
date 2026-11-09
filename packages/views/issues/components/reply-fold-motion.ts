const options: KeyframeAnimationOptions = { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

function motionAllowed(element: HTMLElement) {
  return document.documentElement.dataset.interfaceMotion === "on"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    && typeof element.animate === "function";
}

export function fadeReplyIn(element: HTMLElement) {
  if (!motionAllowed(element)) return;
  const height = element.getBoundingClientRect().height;
  const oldOverflow = element.style.overflow;
  element.style.overflow = "clip";
  element.style.height = "0px";
  requestAnimationFrame(() => {
    if (!element.isConnected || !motionAllowed(element)) { element.style.height = ""; element.style.overflow = oldOverflow; return; }
    const animation = element.animate([{ height: "0px" }, { height: `${height}px` }], { ...options, fill: "forwards" });
    animation.finished.then(() => { element.style.height = ""; element.style.overflow = oldOverflow; animation.cancel(); }, () => { element.style.height = ""; element.style.overflow = oldOverflow; });
  });
}

/** Returns a cancellation function; cancellation never commits the change. */
export function fadeReplyOut(element: HTMLElement, commit: () => void): () => void {
  if (!motionAllowed(element)) {
    commit();
    return () => {};
  }
  let active = true;
  let animation: Animation | undefined;
  const oldOverflow = element.style.overflow;
  const frame = requestAnimationFrame(() => {
    if (!active) return;
    if (!motionAllowed(element)) { active = false; commit(); return; }
    const height = element.getBoundingClientRect().height;
    element.style.overflow = "clip";
    animation = element.animate([{ height: `${height}px` }, { height: "0px" }], { ...options, fill: "forwards" });
    animation.finished.then(() => {
      if (active) { active = false; commit(); }
    }, () => { if (active) { active = false; commit(); } });
  });
  return () => { active = false; cancelAnimationFrame(frame); animation?.cancel(); element.style.overflow = oldOverflow; };
}
