import type { ReactNode } from "react";
import { ThemeProvider } from "@multica/ui/components/common/theme-provider";
import { DesktopThemeSync } from "./desktop-theme-sync";

const themes = ["light", "dark", "graphite-copper", "mist-celadon", "cream-gold", "sakura-blush", "moon-lavender", "deep-ocean"];
const values = { light: "light", dark: "dark", "graphite-copper": "dark", "mist-celadon": "light", "cream-gold": "light", "sakura-blush": "light", "moon-lavender": "light", "deep-ocean": "dark" };

export function DesktopThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider themes={themes} value={values}><DesktopThemeSync />{children}</ThemeProvider>;
}
