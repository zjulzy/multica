import { describe, expect, it } from "vitest";
import { FrozenIssueViewRegistry } from "./frozen-issue-view-registry";

describe("frozen issue view ownership", () => {
  it("resolves a child only for its actual owner and unregisters it", () => {
    const registry = new FrozenIssueViewRegistry();
    const owner = { id: 1 }, otherOwner = { id: 2 }, child = { id: 3 };
    registry.register(owner, child, "issue-a");
    expect(registry.resolve(child)).toEqual({ owner, key: "issue-a" });
    expect(registry.owns(owner, child)).toBe(true);
    expect(registry.owns(otherOwner, child)).toBe(false);
    registry.unregister(child);
    expect(registry.resolve(child)).toBeNull();
  });
  it("removes every child owned by a closed or logged-out window", () => {
    const registry = new FrozenIssueViewRegistry();
    const first = { id: 1 }, second = { id: 2 }, a = { id: 3 }, b = { id: 4 }, c = { id: 5 };
    registry.register(first, a, "a"); registry.register(first, b, "b"); registry.register(second, c, "c");
    expect(registry.clearOwner(first)).toEqual([a, b]);
    expect(registry.resolve(a)).toBeNull();
    expect(registry.resolve(b)).toBeNull();
    expect(registry.resolve(c)).toEqual({ owner: second, key: "c" });
  });
});
