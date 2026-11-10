import { Activity, Profiler, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/** Experimental isolated roots. Not connected to the desktop shell. */
export class IndependentIssueCache {
  private pages = new Map<string, { container: HTMLDivElement; header: HTMLDivElement | null; root: Root; content: ReactNode }>();
  private active: string | null = null;

  constructor(private readonly host: HTMLElement, private readonly headerHost?: HTMLElement) {}

  private tree(mode: "visible" | "hidden", content: ReactNode) {
    const activity = createElement(Activity, { mode, children: content });
    return import.meta.env.DEV
      ? createElement(Profiler, { id: "pinned-issue", onRender: (_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
          const afterCommitMs = performance.now() - commitTime;
          if (actualDuration >= 50 || afterCommitMs >= 50) console.info("[pinned-cache-performance]", JSON.stringify({ kind: "react-render", mode, phase, actualMs: Math.round(actualDuration), baseMs: Math.round(baseDuration), renderElapsedMs: Math.round(commitTime - startTime), commitToCallbackMs: Math.round(afterCommitMs) }));
        }, children: activity })
      : activity;
  }

  show(id: string, node: ReactNode | ((header: HTMLElement | null) => ReactNode)) {
    const switching = this.active !== id;
    const hit = this.pages.has(id);
    const started = import.meta.env.DEV && switching ? performance.now() : 0;
    if (this.active !== id) this.hide();
    let page = this.pages.get(id);
    if (!page) {
      const container = document.createElement("div");
      container.style.display = "contents";
      this.host.appendChild(container);
      const header = this.headerHost ? document.createElement("div") : null;
      if (header) this.headerHost!.appendChild(header);
      page = { container, header, root: createRoot(container), content: null };
      this.pages.set(id, page);
    }
    page.container.style.display = "contents";
    if (page.header) page.header.style.display = "contents";
    page.content = typeof node === "function" ? node(page.header) : node;
    page.root.render(this.tree("visible", page.content));
    this.active = id;
    if (started) {
      console.info("[pinned-cache-performance]", JSON.stringify({ kind: "activate", hit, pages: this.pages.size, atMs: Math.round(started) }));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this.active === id) console.info("[pinned-cache-performance]", JSON.stringify({ kind: "paint", hit, elapsedMs: Math.round(performance.now() - started) }));
      }));
    }
  }

  hide() {
    if (!this.active) return;
    const previous = this.pages.get(this.active);
    if (previous) {
      previous.container.style.display = "none";
      if (previous.header) previous.header.style.display = "none";
      previous.root.render(this.tree("hidden", previous.content));
    }
    this.active = null;
  }

  remove(id: string, deferUnmount = false) {
    const page = this.pages.get(id);
    if (!page) return;
    page.container.remove();
    page.header?.remove();
    this.pages.delete(id);
    if (this.active === id) this.active = null;
    if (deferUnmount) queueMicrotask(() => page.root.unmount());
    else page.root.unmount();
  }

  retain(ids: ReadonlySet<string>) {
    for (const id of this.pages.keys()) if (!ids.has(id)) this.remove(id, true);
  }

  clear(deferUnmount = false) {
    for (const id of this.pages.keys()) this.remove(id, deferUnmount);
  }
}
