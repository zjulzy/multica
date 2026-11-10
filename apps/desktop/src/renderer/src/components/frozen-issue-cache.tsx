import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FrozenPageLifecycle } from "./frozen-page-lifecycle";
type Factory = (header: HTMLElement | null, lifecycle: FrozenPageLifecycle) => ReactNode;
export class FrozenIssueCache {
  private pages = new Map<string, { container: HTMLElement; header: HTMLElement | null; root: Root; lifecycle: FrozenPageLifecycle }>();
  private active: string | null = null;
  constructor(private readonly host: HTMLElement, private readonly headerHost?: HTMLElement) {}
  show(id: string, factory: Factory): void {
    if (this.active && this.active !== id) {
      const old = this.pages.get(this.active);
      if (old) { old.container.style.display = "none"; if (old.header) old.header.style.display = "none"; old.lifecycle.setVisible(false); }
    }
    let page = this.pages.get(id);
    if (!page) {
      const container = document.createElement("div"); this.host.appendChild(container);
      const header = this.headerHost ? document.createElement("div") : null;
      if (header) this.headerHost!.appendChild(header);
      const root = createRoot(container), lifecycle = new FrozenPageLifecycle();
      page = { container, header, root, lifecycle };
      this.pages.set(id, page);
      root.render(factory(header, lifecycle));
    }
    page.container.style.display = "contents";
    if (page.header) page.header.style.display = "contents";
    page.lifecycle.setVisible(true);
    this.active = id;
  }
  remove(id: string): void {
    const page = this.pages.get(id);
    if (!page) return;
    page.lifecycle.dispose(); page.root.unmount(); page.container.remove(); page.header?.remove();
    this.pages.delete(id);
    if (this.active === id) this.active = null;
  }
  clear(): void {
    for (const id of this.pages.keys()) this.remove(id);
  }
}
