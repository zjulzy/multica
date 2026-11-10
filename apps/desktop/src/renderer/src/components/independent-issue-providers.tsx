import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { i18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { WorkspaceSlugProvider } from "@multica/core/paths";
import { WSContextBridge, type WSContextValue } from "@multica/core/realtime";
import { PageHeaderPortalProvider } from "@multica/views/layout";
import { NavigationBridgeProvider, type NavigationBridgeSnapshot } from "@multica/views/navigation";

/** Reuse shell-owned resources without creating another websocket or query cache. */
export function IndependentIssueProviders({ queryClient, ws, i18n, navigation, slug, header, children }: {
  queryClient: QueryClient; ws: WSContextValue; i18n: i18n; navigation: NavigationBridgeSnapshot;
  slug: string; header: HTMLElement | null; children: ReactNode;
}) {
  return <I18nextProvider i18n={i18n}><QueryClientProvider client={queryClient}>
    <WSContextBridge value={ws}><NavigationBridgeProvider value={navigation}>
      <WorkspaceSlugProvider slug={slug}><PageHeaderPortalProvider value={header}>{children}</PageHeaderPortalProvider></WorkspaceSlugProvider>
    </NavigationBridgeProvider></WSContextBridge>
  </QueryClientProvider></I18nextProvider>;
}
