// Only used by the opt-in development experiment. Vite normally reloads the
// page on every HMR websocket disconnect, which destroys a frozen guest.
export function patchViteClientForFrozenGuest(source: string): string {
  const marker = /await waitForSuccessfulPing\(url\.href\);\s*location\.reload\(\);/g;
  const matches = [...source.matchAll(marker)];
  if (matches.length !== 1) throw new Error("Unsupported Vite client disconnect handler");
  return source.replace(marker, `await waitForSuccessfulPing(url.href);
    if (globalThis.desktopAPI?.isEmbeddedIssue) await transport.connect(createHMRHandler(handleMessage));
    else location.reload();`);
}
