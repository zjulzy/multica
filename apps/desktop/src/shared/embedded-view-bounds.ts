type Rect = { x: number; y: number; width: number; height: number };
export function embeddedViewBounds(rect: Rect, viewport: { width: number; height: number }): Rect | null {
  if (![rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const x = Math.max(0, Math.round(rect.x)), y = Math.max(0, Math.round(rect.y));
  const right = Math.min(Math.round(viewport.width), Math.round(rect.x + rect.width));
  const bottom = Math.min(Math.round(viewport.height), Math.round(rect.y + rect.height));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}
