import { useLayoutEffect } from "react";
import { useTheme } from "@multica/ui/components/common/theme-provider";

export function DesktopThemeSync() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  useLayoutEffect(() => {
    if (theme === "pink") setTheme("dark");
    if (resolvedTheme && ["graphite-copper", "mist-celadon", "cream-gold"].includes(resolvedTheme)) document.documentElement.dataset.desktopTheme = resolvedTheme;
    else delete document.documentElement.dataset.desktopTheme;
    return () => { delete document.documentElement.dataset.desktopTheme; };
  }, [resolvedTheme, theme, setTheme]);
  return null;
}
