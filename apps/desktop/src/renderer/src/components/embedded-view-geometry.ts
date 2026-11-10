type Rect = { x: number; y: number; width: number; height: number };
export function observeEmbeddedGeometry(element: HTMLElement, send: (rect: Rect) => void): () => void {
  let frame: number | null = null;
  let stopped = false;
  const schedule = () => {
    if (stopped || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (stopped) return;
      const { x, y, width, height } = element.getBoundingClientRect();
      send({ x, y, width, height });
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(element);
  window.addEventListener("resize", schedule);
  schedule();
  return () => {
    stopped = true;
    observer.disconnect();
    window.removeEventListener("resize", schedule);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}
