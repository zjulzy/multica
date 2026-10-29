import { useLayoutEffect, useRef, type RefObject } from "react";

export function usePageMotion(host: RefObject<HTMLElement | null>, url: string | null, enabled: boolean, animateOnMount = false) {
  const pathname = url?.split(/[?#]/, 1)[0] ?? null;
  const previousUrl = useRef(animateOnMount ? null : pathname);
  useLayoutEffect(() => {
    const changed = previousUrl.current !== pathname;
    previousUrl.current = pathname;
    if (!changed || !enabled || !pathname || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const element = host.current?.firstElementChild;
    if (!(element instanceof HTMLElement) || typeof element.animate !== "function") return;
    const animation = element.animate(
      [{ opacity: 0.7, translate: "0 4px" }, { opacity: 1, translate: "0 0" }],
      { duration: 160, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [host, pathname, enabled]);
}
