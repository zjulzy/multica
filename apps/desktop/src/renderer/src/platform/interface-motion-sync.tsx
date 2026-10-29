import { useLayoutEffect } from "react";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function InterfaceMotionSync() {
  const enabled = useDesktopPrefsStore((state) => state.interfaceMotionEnabled);
  useLayoutEffect(() => {
    document.documentElement.dataset.interfaceMotion = enabled ? "on" : "off";
    return () => { delete document.documentElement.dataset.interfaceMotion; };
  }, [enabled]);
  return null;
}
