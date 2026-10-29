"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // Use `resolvedTheme` instead of `theme` (which can be "system"). When we
  // forward "system", sonner reads
  // `prefers-color-scheme` itself, and the Electron renderer's media query
  // can disagree with next-themes' `html.dark` class — that's why the toast
  // sometimes rendered light on a dark UI. Custom desktop themes need to be
  // mapped to Sonner's supported light/dark values as well.
  const { resolvedTheme = "system" } = useTheme()
  const sonnerTheme = resolvedTheme === "graphite-copper" ? "dark"
    : resolvedTheme === "mist-celadon" || resolvedTheme === "cream-gold" ? "light"
    : resolvedTheme

  return (
    <Sonner
      theme={sonnerTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-success" />
        ),
        info: (
          <InfoIcon className="size-4 text-info" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-warning" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-destructive" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-brand" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
