import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Experimental data-notification isolation, not connected to the app. */
export class FrozenQueryMirror {
  private visible = true;
  private dirty = new Map<string, QueryKey>();
  private unsubscribe: () => void;
  private unsubscribeLocal: () => void;
  private copying = false;
  private pushing = false;
  private syncedData = new Map<string, unknown>();
  private fetchBases = new Map<string, unknown>();
  constructor(private readonly shared: QueryClient, private readonly local: QueryClient, private readonly allow: (key: QueryKey) => boolean = () => true) {
    for (const query of shared.getQueryCache().getAll()) if (this.allow(query.queryKey)) this.copy(query.queryKey);
    this.unsubscribe = shared.getQueryCache().subscribe((event) => {
      if (this.pushing || (event.type !== "updated" && event.type !== "removed")) return;
      const { query } = event;
      if (!this.allow(query.queryKey)) return;
      if (this.visible) this.copy(query.queryKey);
      else this.dirty.set(query.queryHash, query.queryKey);
    });
    this.unsubscribeLocal = local.getQueryCache().subscribe((event) => {
      if (this.copying || event.type !== "updated") return;
      const { query } = event;
      if (!this.allow(query.queryKey)) return;
      if (event.action.type === "fetch") {
        this.fetchBases.set(query.queryHash, this.shared.getQueryData(query.queryKey));
        return;
      }
      if (event.action.type === "invalidate") {
        this.pushing = true;
        try { void this.shared.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: "none" }); }
        finally { this.pushing = false; }
        return;
      }
      if (event.action.type !== "success") return;
      const sharedQuery = this.shared.getQueryCache().find({ queryKey: query.queryKey, exact: true });
      const base = event.action.manual ? this.syncedData.get(query.queryHash) : this.fetchBases.get(query.queryHash);
      this.fetchBases.delete(query.queryHash);
      if (sharedQuery && sharedQuery.state.data !== base) {
        this.dirty.set(query.queryHash, query.queryKey);
        void this.shared.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: "none" });
        return;
      }
      this.pushing = true;
      try {
        this.shared.setQueryData(query.queryKey, query.state.data);
        this.syncedData.set(query.queryHash, this.shared.getQueryData(query.queryKey));
      } finally { this.pushing = false; }
    });
  }
  private copy(key: QueryKey): void {
    const query = this.shared.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) { this.local.removeQueries({ queryKey: key, exact: true }); return; }
    this.syncedData.set(query.queryHash, query.state.data);
    const localState = this.local.getQueryState(key);
    if (query.state.data !== undefined && (this.local.getQueryData(key) !== query.state.data || (!query.state.isInvalidated && localState?.isInvalidated) || (query.state.status === "success" && localState?.status === "error"))) {
      this.copying = true;
      try { this.local.setQueryData(key, query.state.data, { updatedAt: query.state.dataUpdatedAt }); }
      finally { this.copying = false; }
    }
    if (query.state.status === "error") {
      const localQuery = this.local.getQueryCache().find({ queryKey: key, exact: true }) ?? this.local.getQueryCache().build(this.local, { queryKey: key });
      localQuery.setState({ status: "error", error: query.state.error, errorUpdatedAt: query.state.errorUpdatedAt, errorUpdateCount: query.state.errorUpdateCount });
    }
    if (query.state.isInvalidated) {
      this.copying = true;
      try { void this.local.invalidateQueries({ queryKey: key, exact: true, refetchType: "none" }); }
      finally { this.copying = false; }
    }
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (visible) {
      for (const key of this.dirty.values()) this.copy(key);
      this.dirty.clear();
    }
  }
  dispose(): void { this.unsubscribe(); this.unsubscribeLocal(); this.dirty.clear(); this.syncedData.clear(); this.fetchBases.clear(); }
}
