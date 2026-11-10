import { useRef, type ReactNode } from "react";
import { NavigationSnapshotProvider, type NavigationAdapter } from "@multica/views/navigation";

/** Keep inactive issue trees from subscribing to unrelated route changes. */
export function StableIssueNavigation({ navigation, committedPath, children }: { navigation: NavigationAdapter | null; committedPath: string | null; children: ReactNode }) {
  const lastActive = useRef<NavigationAdapter | null>(null);
  if (navigation && navigation.pathname === committedPath) lastActive.current = navigation;
  if (!lastActive.current) return null;
  return <NavigationSnapshotProvider value={lastActive.current}>{children}</NavigationSnapshotProvider>;
}
