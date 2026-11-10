export class FrozenPageLifecycle {
  private visible = true;
  private disposed = false;
  private registrations = new Set<{ start: () => () => void; stop?: () => void }>();

  track(start: () => () => void): () => void {
    if (this.disposed) return () => {};
    const entry: { start: () => () => void; stop?: () => void } = { start };
    this.registrations.add(entry);
    if (this.visible) entry.stop = start();
    return () => {
      if (!this.registrations.delete(entry)) return;
      entry.stop?.();
      entry.stop = undefined;
    };
  }

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    for (const entry of this.registrations) {
      if (visible) entry.stop = entry.start();
      else { entry.stop?.(); entry.stop = undefined; }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.setVisible(false);
    this.disposed = true;
    this.registrations.clear();
  }
}
