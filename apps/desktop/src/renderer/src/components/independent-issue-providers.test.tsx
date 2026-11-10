import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceSlug } from "@multica/core/paths";
import { useWS } from "@multica/core/realtime";
import { useNavigation, useReportNavigating } from "@multica/views/navigation";
import { PageHeader } from "@multica/views/layout";
import { IndependentIssueCache } from "./independent-issue-cache";
import { IndependentIssueProviders } from "./independent-issue-providers";

describe("independent issue providers", () => {
  it("bridges the existing query client, connection, locale, workspace and shell navigation", async () => {
    const query = new QueryClient();
    const ws = { subscribe: vi.fn(() => vi.fn()), onReconnect: vi.fn(() => vi.fn()) };
    const i18n = createInstance(); await i18n.init({ lng: "en", resources: { en: { translation: { title: "Test title" } } } });
    const report = vi.fn();
    const navigation = { navigation: { pathname: "/team/issues/a", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (p: string) => p }, pending: false, report };
    function Probe() {
      const { i18n: currentI18n } = useTranslation();
      expect(currentI18n.language).toBe(i18n.language);
      expect(useQueryClient()).toBe(query);
      expect(useWS()).toBe(ws);
      expect(useWorkspaceSlug()).toBe("team");
      expect(useNavigation().pathname).toBe("/team/issues/a");
      useReportNavigating(true);
      return <span>{currentI18n.getResource("en", "translation", "title")}</span>;
    }
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<IndependentIssueProviders queryClient={query} ws={ws} i18n={i18n} navigation={navigation} slug="team" header={null}><Probe /></IndependentIssueProviders>));
    expect(screen.getByText("Test title")).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith(1);
    act(() => root.unmount()); host.remove();
    expect(report).toHaveBeenCalledWith(-1);
  });
  it("shows only the current real page header across issue and normal-page switches", async () => {
    const query = new QueryClient();
    const ws = { subscribe: vi.fn(() => vi.fn()), onReconnect: vi.fn(() => vi.fn()) };
    const i18n = createInstance(); await i18n.init({ lng: "en", resources: { en: { translation: {} } } });
    const navigation = { navigation: { pathname: "/team/issues/a", searchParams: new URLSearchParams(), hash: "", push: vi.fn(), replace: vi.fn(), back: vi.fn(), getShareableUrl: (p: string) => p }, pending: false, report: null };
    const host = document.createElement("div"), header = document.createElement("div");
    document.body.append(host, header);
    const cache = new IndependentIssueCache(host, header);
    const page = (name: string) => (target: HTMLElement | null) =>
      <IndependentIssueProviders queryClient={query} ws={ws} i18n={i18n} navigation={navigation} slug="team" header={target}>
        <PageHeader><span>{name}</span></PageHeader><div>body-{name}</div>
      </IndependentIssueProviders>;
    act(() => cache.show("a", page("issue-a")));
    act(() => cache.show("b", page("issue-b")));
    expect(screen.getByText("issue-a")).not.toBeVisible();
    expect(screen.getByText("issue-b")).toBeVisible();
    act(() => cache.hide());
    const normalHeader = document.createElement("span"); normalHeader.textContent = "normal-page"; header.append(normalHeader);
    expect(screen.getByText("issue-a")).not.toBeVisible();
    expect(screen.getByText("issue-b")).not.toBeVisible();
    expect(screen.getByText("normal-page")).toBeVisible();
    normalHeader.remove();
    act(() => cache.show("a", page("issue-a")));
    expect(screen.getByText("issue-a")).toBeVisible();
    expect(screen.getByText("issue-b")).not.toBeVisible();
    act(() => cache.clear());
    host.remove(); header.remove();
  });
});
