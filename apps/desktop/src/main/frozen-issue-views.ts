export type ViewBounds = { x: number; y: number; width: number; height: number };
export interface FrozenIssueView {
  setVisible(visible: boolean): void;
  setBounds(bounds: ViewBounds): void;
  freeze(): Promise<void>;
  resume(): Promise<void>;
  send(channel: string, payload: unknown): void;
  destroy(): void;
}
/** Experimental lifecycle controller; not registered with the desktop application. */
export class FrozenIssueViews {
  private pages = new Map<string, FrozenIssueView>();
  private frozen = new Set<string>();
  private active: string | null = null;
  private requested: string | null = null;
  private revision = 0;
  private tail: Promise<void> = Promise.resolve();
  private disposed = false;
  constructor(private readonly create: (id: string) => FrozenIssueView | Promise<FrozenIssueView>) {}
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const pending = this.tail.then(operation);
    this.tail = pending.catch(() => {});
    return pending;
  }
  show(id: string, bounds: ViewBounds): Promise<void> {
    this.requested = id;
    const revision = ++this.revision;
    return this.enqueue(async () => {
      if (this.disposed || revision !== this.revision) return;
      if (this.active && this.active !== id) {
        const oldId = this.active;
        const old = this.pages.get(oldId)!;
        this.active = null;
        old.setVisible(false);
        try { await old.freeze(); this.frozen.add(oldId); }
        catch (error) { old.destroy(); this.pages.delete(oldId); throw error; }
      }
      if (revision !== this.revision || this.disposed) return;
      let view = this.pages.get(id);
      if (!view) {
        view = await this.create(id);
        if (revision !== this.revision || this.disposed) { view.destroy(); return; }
        this.pages.set(id, view);
      }
      if (this.frozen.has(id)) {
        try { await view.resume(); this.frozen.delete(id); }
        catch (error) { view.destroy(); this.pages.delete(id); this.frozen.delete(id); throw error; }
      }
      if (revision !== this.revision || this.disposed) {
        if (!this.frozen.has(id)) {
          try { await view.freeze(); this.frozen.add(id); }
          catch (error) { view.destroy(); this.pages.delete(id); throw error; }
        }
        return;
      }
      view.setBounds(bounds);
      view.setVisible(true);
      this.active = id;
    });
  }
  isVisible(id: string): boolean { return !this.disposed && this.active === id && this.requested === id; }
  sendIfVisible(id: string, channel: string, payload: unknown): boolean {
    if (!this.isVisible(id)) return false;
    this.pages.get(id)?.send(channel, payload);
    return true;
  }
  resize(id: string, bounds: ViewBounds): boolean {
    if (!this.isVisible(id)) return false;
    this.pages.get(id)?.setBounds(bounds);
    return true;
  }
  hide(): Promise<void> {
    this.requested = null; this.revision++;
    return this.enqueue(async () => {
      if (!this.active) return;
      const id = this.active, view = this.pages.get(id)!;
      this.active = null;
      view.setVisible(false);
      try { await view.freeze(); this.frozen.add(id); }
      catch (error) { view.destroy(); this.pages.delete(id); throw error; }
    });
  }
  remove(id: string): Promise<void> {
    if (this.requested === id) { this.requested = null; this.revision++; }
    return this.enqueue(async () => {
      const view = this.pages.get(id);
      if (!view) return;
      if (this.active === id) this.active = null;
      this.pages.delete(id); this.frozen.delete(id); view.destroy();
    });
  }
  retain(ids: ReadonlySet<string>): Promise<void> {
    if (this.requested && !ids.has(this.requested)) { this.requested = null; this.revision++; }
    return this.enqueue(async () => {
      for (const [id, view] of this.pages) {
        if (ids.has(id)) continue;
        if (this.active === id) this.active = null;
        this.pages.delete(id); this.frozen.delete(id); view.destroy();
      }
    });
  }
  dispose(): Promise<void> {
    this.disposed = true; this.requested = null; this.revision++;
    return this.enqueue(async () => {
      for (const view of this.pages.values()) view.destroy();
      this.pages.clear(); this.frozen.clear(); this.active = null;
    });
  }
}
