import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { issueKeys } from "@multica/core/issues/queries";
import { quickActionKeys } from "@multica/core/quick-actions";
import { describe, expect, it, vi } from "vitest";
import { createEmbeddedChildRefresh } from "./embedded-child-refresh";

describe("cached issue child refresh", () => {
  it("refreshes the workspace quick actions when returning to a cached issue", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const key = quickActionKeys.list("workspace");
    let actions = ["old"];
    const fetchActions = vi.fn(async () => [...actions]);
    const observer = new QueryObserver(client, { queryKey: key, queryFn: fetchActions, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    const refresh = createEmbeddedChildRefresh(client, "workspace", "parent");
    await refresh();
    expect(fetchActions).toHaveBeenCalledTimes(1);
    actions = ["new"];
    await refresh();
    expect(client.getQueryData(key)).toEqual(["new"]);
    expect(fetchActions).toHaveBeenCalledTimes(2);
    expect(client.getQueryState(quickActionKeys.list("other"))).toBeUndefined();
    unsubscribe(); client.clear();
  });
  it("revalidates only the active parent's children after returning to a frozen page", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const key = issueKeys.children("workspace", "parent");
    let children = ["first"];
    const fetchChildren = vi.fn(async () => [...children]);
    const observer = new QueryObserver(client, { queryKey: key, queryFn: fetchChildren, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    const refresh = createEmbeddedChildRefresh(client, "workspace", "parent");
    await refresh();
    expect(fetchChildren).toHaveBeenCalledTimes(1);
    children = ["first", "new"];
    await refresh();
    expect(fetchChildren).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(key)).toEqual(["first", "new"]);
    expect(client.getQueryState(issueKeys.children("workspace", "other"))).toBeUndefined();
    unsubscribe(); client.clear();
  });
});
