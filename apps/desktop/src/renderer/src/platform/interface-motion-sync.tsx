import { useLayoutEffect } from "react";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function InterfaceMotionSync() {
  const enabled = useDesktopPrefsStore((state) => state.interfaceMotionEnabled);
  const sidebarFontSize = useDesktopPrefsStore((state) => state.sidebarFontSize);
  useLayoutEffect(() => {
    document.documentElement.dataset.interfaceMotion = enabled ? "on" : "off";
    return () => { delete document.documentElement.dataset.interfaceMotion; };
  }, [enabled]);
  useLayoutEffect(() => {
    document.documentElement.dataset.sidebarFontSize = sidebarFontSize;
    return () => { delete document.documentElement.dataset.sidebarFontSize; };
  }, [sidebarFontSize]);
  return null;
}
