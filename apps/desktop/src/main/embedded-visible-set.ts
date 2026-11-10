/** Coordinates independent visible surfaces without freezing another surface's page. */
export class EmbeddedVisibleSet {
  private readonly active = new Set<string>();
  constructor(private readonly actions: { resume: (id: string) => Promise<void>; freeze: (id: string) => Promise<void> }) {}

  has(id: string): boolean { return this.active.has(id); }
  forget(id: string): void { this.active.delete(id); }

  async show(ids: readonly string[]): Promise<void> {
    const next = new Set(ids);
    for (const id of this.active) if (!next.has(id)) {
      await this.actions.freeze(id);
      this.active.delete(id);
    }
    for (const id of next) if (!this.active.has(id)) {
      await this.actions.resume(id);
      this.active.add(id);
    }
  }
}
