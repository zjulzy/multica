/** Limit session chips before they can crowd fixed controls or status alerts. */
export function chatBarMaxChips(width: number, placement: "top" | "bottom", statusWidth: number): number {
  if (placement === "bottom") return Math.min(4, Math.max(1, Math.floor((width - 560) / 170)));
  return Math.min(4, Math.max(0, Math.floor((width - Math.max(0, statusWidth) - 180) / 170)));
}
