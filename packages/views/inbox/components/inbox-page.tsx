"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspacePaths } from "@multica/core/paths";
import { useNavigation } from "../../navigation";
import { InboxSurface, type InboxSurfaceController } from "./inbox-surface";
import { ARCHIVED_VIEW_PARAM, type InboxView } from "./inbox-view";

export function InboxPage() {
  const { searchParams, replace } = useNavigation();
  const wsPaths = useWorkspacePaths();
  const urlIssue = searchParams.get("issue") ?? "";
  const urlView: InboxView =
    searchParams.get("view") === ARCHIVED_VIEW_PARAM ? "archived" : "inbox";
  const [selectedKey, setSelectedKeyState] = useState(() => urlIssue);
  const [view, setViewState] = useState<InboxView>(() => urlView);

  useEffect(() => {
    setSelectedKeyState(urlIssue);
  }, [urlIssue]);

  useEffect(() => {
    setViewState(urlView);
  }, [urlView]);

  const buildInboxUrl = useCallback(
    (nextView: InboxView, key: string) => {
      const params = new URLSearchParams();
      if (nextView === "archived") params.set("view", ARCHIVED_VIEW_PARAM);
      if (key) params.set("issue", key);
      const query = params.toString();
      const inboxPath = wsPaths.inbox();
      return query ? `${inboxPath}?${query}` : inboxPath;
    },
    [wsPaths],
  );

  const setSelectedKey = useCallback(
    (key: string) => {
      setSelectedKeyState(key);
      replace(buildInboxUrl(view, key));
    },
    [buildInboxUrl, replace, view],
  );

  const setView = useCallback(
    (nextView: InboxView) => {
      setViewState(nextView);
      setSelectedKeyState("");
      replace(buildInboxUrl(nextView, ""));
    },
    [buildInboxUrl, replace],
  );

  const onUnresolvedSelection = useCallback(
    (key: string) => replace(wsPaths.issueDetail(key)),
    [replace, wsPaths],
  );

  const controller: InboxSurfaceController = {
    view,
    selectedKey,
    setView,
    setSelectedKey,
    onUnresolvedSelection,
  };

  return (
    <InboxSurface
      controller={controller}
      variant="page"
      layoutId="multica_inbox_layout"
      enableGlobalArchiveShortcut
    />
  );
}
