interface ReplyFoldAnchor {
  scroller: HTMLElement;
  replyId: string;
  top: number;
  hadFocus: boolean;
  originalScrollTop: number;
}

const spacerListeners = new WeakMap<HTMLElement, () => void>();

export function clearReplyFoldSpacer(scroller: HTMLElement): void {
  const previous = spacerListeners.get(scroller);
  if (previous) scroller.removeEventListener("scroll", previous);
  spacerListeners.delete(scroller);
  const spacer = scroller.querySelector<HTMLElement>("[data-reply-fold-spacer]");
  if (spacer) spacer.style.height = "0px";
}

export function captureReplyFoldAnchor(trigger: HTMLElement, replyId: string): ReplyFoldAnchor | null {
  const scroller = trigger.closest<HTMLElement>("[data-issue-scroll-container]");
  if (!scroller) return null;
  return { scroller, replyId, top: trigger.getBoundingClientRect().top, hadFocus: trigger.ownerDocument.activeElement === trigger, originalScrollTop: scroller.scrollTop };
}

/** Keep the clicked reply at the same viewport position after its body disappears. */
export function restoreReplyFoldAnchor(anchor: ReplyFoldAnchor): void {
  const { scroller, replyId, top, hadFocus } = anchor;
  const summary = scroller.querySelector<HTMLElement>(`[data-reply-fold-id=${JSON.stringify(replyId)}]`);
  const icon = summary?.querySelector<HTMLElement>("[data-reply-fold-icon]");
  const spacer = scroller.querySelector<HTMLElement>("[data-reply-fold-spacer]");
  if (!summary || !icon || !spacer) return;

  const beforeAdjust = scroller.scrollTop;
  const iconDelta = icon.getBoundingClientRect().top - top;
  // Tiny differences between the expanded button and the summary icon are
  // layout rounding, not a meaningful viewport movement. Correcting them on
  // every fold makes the page creep by a pixel or two each time.
  const nearlyUnchanged = Math.abs(iconDelta) <= 3 && Math.abs(beforeAdjust - anchor.originalScrollTop) <= 3;
  const target = Math.max(0, nearlyUnchanged ? anchor.originalScrollTop : beforeAdjust + iconDelta);
  const previousSpace = parseFloat(spacer.style.height) || 0;
  const naturalMaximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight - previousSpace);
  const requiredSpace = Math.max(0, Math.ceil(target - naturalMaximum));
  spacer.style.height = `${requiredSpace}px`;
  scroller.scrollTop = target;
  if (hadFocus && summary.ownerDocument.activeElement !== summary) summary.focus({ preventScroll: true });
  if (process.env.NODE_ENV === "development") {
    console.info("[issue-load-performance]", JSON.stringify({ kind: "fold-anchor", beforeScroll: Math.round(anchor.originalScrollTop), beforeAdjust: Math.round(beforeAdjust), iconDelta: Math.round(iconDelta * 10) / 10, afterScroll: Math.round(scroller.scrollTop), desiredTop: Math.round(top), actualTop: Math.round(icon.getBoundingClientRect().top), spacer: requiredSpace }));
  }

  const previousListener = spacerListeners.get(scroller);
  if (previousListener) scroller.removeEventListener("scroll", previousListener);
  if (requiredSpace > 0) {
    const release = () => {
      const currentSpace = parseFloat(spacer.style.height) || 0;
      const maxWithoutSpace = Math.max(0, scroller.scrollHeight - scroller.clientHeight - currentSpace);
      if (scroller.scrollTop > maxWithoutSpace + 1) return;
      spacer.style.height = "0px";
      scroller.removeEventListener("scroll", release);
      spacerListeners.delete(scroller);
    };
    spacerListeners.set(scroller, release);
    scroller.addEventListener("scroll", release, { passive: true });
  } else {
    spacerListeners.delete(scroller);
  }
}
