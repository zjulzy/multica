// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueViewPreferenceOptions, useUpdateIssueViewPreference } from "./preferences";
import { issueViewEverywhereOptions } from "./queries";
import { setCurrentWorkspace } from "../platform/workspace-storage";

const mocks = vi.hoisted(() => ({
  getPreference: vi.fn(), putPreference: vi.fn(), listViews: vi.fn(), listProjects: vi.fn(),
  userId: "user-a",
}));
vi.mock("../api", () => ({ api: {
  getBaseUrl: () => "https://server.example", getIssueViewPreference: mocks.getPreference,
  putIssueViewPreference: mocks.putPreference, listIssueViews: mocks.listViews, listProjects: mocks.listProjects,
} }));
vi.mock("../auth", () => ({ useAuthStore: { getState: () => ({ user: { id: mocks.userId } }) } }));
vi.mock("../paths/hooks", () => ({ useWorkspaceSlug: () => "workspace" }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.userId = "user-a";
  setCurrentWorkspace("workspace-a", "ws-a");
});

describe("older server compatibility", () => {
  it("persists unsupported sidebar preferences locally for each user and workspace", async () => {
    mocks.getPreference.mockRejectedValue(Object.assign(new Error("unsupported scope"), { status: 400 }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const scope = { scope_type: "sidebar" } as const;
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({
      preference: useQuery(issueViewPreferenceOptions("ws-a", scope)),
      save: useUpdateIssueViewPreference("ws-a", scope),
    }), { wrapper });
    await waitFor(() => expect(result.current.preference.isSuccess).toBe(true));
    act(() => result.current.save({ order: ["view:1"], hidden: [] }));
    await waitFor(() => expect(result.current.preference.data?.prefs.order).toEqual(["view:1"]));
    await waitFor(() => expect(localStorage.length).toBe(1));
    expect(mocks.putPreference).not.toHaveBeenCalled();
    const fresh = new QueryClient();
    expect((await fresh.fetchQuery(issueViewPreferenceOptions("ws-a", scope))).prefs.order).toEqual(["view:1"]);
    mocks.getPreference.mockResolvedValue({ scope_type: "sidebar", scope_id: null, updated_at: "", prefs: { order: [], hidden: [] } });
    expect((await new QueryClient().fetchQuery(issueViewPreferenceOptions("ws-a", scope))).prefs.order).toEqual(["view:1"]);
    mocks.getPreference.mockResolvedValue({ scope_type: "sidebar", scope_id: null, updated_at: "remote", prefs: { order: ["view:other-device"], hidden: [] } });
    expect((await new QueryClient().fetchQuery(issueViewPreferenceOptions("ws-a", scope))).prefs.order).toEqual(["view:1"]);
    mocks.getPreference.mockRejectedValue(Object.assign(new Error("unsupported scope"), { status: 400 }));
    mocks.userId = "user-b";
    expect((await new QueryClient().fetchQuery(issueViewPreferenceOptions("ws-a", scope))).updated_at).toBe("");
    setCurrentWorkspace("workspace-b", "ws-b");
    expect((await new QueryClient().fetchQuery(issueViewPreferenceOptions("ws-b", scope))).updated_at).toBe("");
  });

  it("does not treat authentication errors as unsupported sidebar preferences", async () => {
    mocks.getPreference.mockRejectedValue(Object.assign(new Error("unauthorized"), { status: 401 }));
    await expect(new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(issueViewPreferenceOptions("ws-a", { scope_type: "sidebar" }))).rejects.toMatchObject({ status: 401 });
  });

  it("includes project views when the cross-scope endpoint is unavailable", async () => {
    mocks.listProjects.mockResolvedValue({ projects: [{ id: "p1" }, { id: "p2" }] });
    mocks.listViews.mockImplementation(async (scope: { scope_type: string; scope_id?: string }) => {
      if (scope.scope_type === "all") throw Object.assign(new Error("unsupported"), { status: 400 });
      return [{ id: scope.scope_id ?? scope.scope_type }];
    });
    const views = await new QueryClient().fetchQuery(issueViewEverywhereOptions("ws-a"));
    expect(views.map((view) => view.id)).toEqual(["workspace", "my", "p1", "p2"]);
  });

  it("keeps the original workspace when the fallback runs after a workspace switch", async () => {
    let rejectFirst!: (error: Error) => void;
    mocks.listViews.mockImplementation((scope: { scope_type: string }) => scope.scope_type === "all"
      ? new Promise((_resolve, reject) => { rejectFirst = reject; })
      : Promise.resolve([]));
    mocks.listProjects.mockResolvedValue({ projects: [{ id: "p1" }] });
    setCurrentWorkspace("workspace-a", "ws-a");
    const result = new QueryClient().fetchQuery(issueViewEverywhereOptions("ws-a"));
    setCurrentWorkspace("workspace-b", "ws-b");
    rejectFirst(Object.assign(new Error("unsupported"), { status: 400 }));
    await result;
    expect(mocks.listViews.mock.calls.map((call) => call[1])).toEqual(["workspace-a", "workspace-a", "workspace-a", "workspace-a"]);
    expect(mocks.listProjects).toHaveBeenCalledWith(undefined, "workspace-a");
  });

  it("keeps the original workspace across a network retry", async () => {
    let attempts = 0;
    mocks.listViews.mockImplementation(async () => {
      if (++attempts === 1) {
        setCurrentWorkspace("workspace-b", "ws-b");
        throw new Error("temporary network failure");
      }
      return [];
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 1 } } });
    await qc.fetchQuery(issueViewEverywhereOptions("ws-a"));
    expect(mocks.listViews.mock.calls.map((call) => call[1])).toEqual(["workspace-a", "workspace-a"]);
  });

  it("keeps preference reads in the original workspace across a retry", async () => {
    let attempts = 0;
    mocks.getPreference.mockImplementation(async () => {
      if (++attempts === 1) {
        setCurrentWorkspace("workspace-b", "ws-b");
        throw new Error("temporary network failure");
      }
      return { scope_type: "sidebar", scope_id: null, updated_at: "server", prefs: { order: [], hidden: [] } };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 1 } } });
    await qc.fetchQuery(issueViewPreferenceOptions("ws-a", { scope_type: "sidebar" }));
    expect(mocks.getPreference.mock.calls.map((call) => call[1])).toEqual(["workspace-a", "workspace-a"]);
  });
});
