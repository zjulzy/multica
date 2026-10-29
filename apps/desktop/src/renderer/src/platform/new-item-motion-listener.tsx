import { useCallback, useEffect, useRef } from "react";
import { useWSEvent } from "@multica/core/realtime";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";
import { watchNewItem } from "./new-item-motion";

export function NewItemMotionListener() {
  const enabled = useDesktopPrefsStore((state) => state.interfaceMotionEnabled);
  const seen = useRef(new Map<string, number>());
  const watches = useRef(new Set<() => void>());
  useEffect(() => () => { for (const stop of watches.current) stop(); watches.current.clear(); }, [enabled]);
  const watch = useCallback((kind: "issue" | "inbox", id: string | undefined) => {
    if (!enabled || !id || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const key = `${kind}:${id}`;
    const now = Date.now();
    for (const [oldKey, timestamp] of seen.current) if (now - timestamp > 30000) seen.current.delete(oldKey);
    if (seen.current.has(key)) return;
    seen.current.set(key, now);
    const stop = watchNewItem(kind === "issue" ? "data-peek-target" : "data-motion-inbox-id", id);
    watches.current.add(stop);
    setTimeout(() => watches.current.delete(stop), 4000);
  }, [enabled]);
  const onIssue = useCallback((payload: unknown) => {
    watch("issue", (payload as { issue?: { id?: string } }).issue?.id);
  }, [watch]);
  const onInbox = useCallback((payload: unknown) => {
    watch("inbox", (payload as { item?: { id?: string } }).item?.id);
  }, [watch]);
  useWSEvent("issue:created", onIssue);
  useWSEvent("inbox:new", onInbox);
  return null;
}
