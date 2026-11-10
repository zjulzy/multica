type Identified = { id: number };
export class FrozenIssueViewRegistry<Owner extends Identified = Identified, Child extends Identified = Identified> {
  private entries = new Map<Child, { owner: Owner; key: string }>();
  register(owner: Owner, child: Child, key: string): void {
    if (this.entries.has(child)) throw new Error("Issue view already registered");
    this.entries.set(child, { owner, key });
  }
  resolve(child: Child): { owner: Owner; key: string } | null { return this.entries.get(child) ?? null; }
  owns(owner: Owner, child: Child): boolean { return this.entries.get(child)?.owner === owner; }
  unregister(child: Child): void { this.entries.delete(child); }
  clearOwner(owner: Owner): Child[] {
    const removed: Child[] = [];
    for (const [child, entry] of this.entries) if (entry.owner === owner) { this.entries.delete(child); removed.push(child); }
    return removed;
  }
}
