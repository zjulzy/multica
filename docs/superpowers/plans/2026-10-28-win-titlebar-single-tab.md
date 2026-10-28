# Windows 标题栏融合 + 单页签模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 上去掉 Multica Desktop 的原生标题栏（窗口按钮嵌入页签栏右上角、颜色随主题），并提供「单页签模式」开关，把所有开新页签的导航改成当前页跳转。

**Architecture:** 主进程按平台生成 `BrowserWindow` 的标题栏选项（Windows 用 `hidden` + `titleBarOverlay`），渲染层通过一条新 IPC 把主题色同步给覆盖层；渲染层新增一个持久化偏好 store，`navigation.tsx` 的 adapter、内容链接分发、三个快捷键和 `MainTopBar` 读取它做分流。页签数据结构（`tab-store.ts`）不动。

**Tech Stack:** Electron 44、React、zustand（persist）、next-themes、vitest + testing-library、pnpm 10（corepack）、Go 1.27（打包内嵌 CLI）。

**仓库与命令约定**
- 仓库 `E:\code\multica`，分支 `lilith/main`。所有命令在 `E:\code\multica\apps\desktop` 下执行，用 Git Bash。
- 每次新开 shell 先 `export PATH="/c/Program Files/Go/bin:/c/Program Files/GitHub CLI:$PATH"`。
- 跑单测：`corepack pnpm vitest run <文件路径>`；全量：`corepack pnpm test`。
- 类型检查：`corepack pnpm typecheck`。
- 设计文档：`docs/superpowers/specs/2026-10-28-win-titlebar-single-tab-design.md`。

---

## 文件结构

新建：
- `apps/desktop/src/main/title-bar.ts` — 按平台生成标题栏窗口选项的纯函数 + 覆盖层颜色校验。
- `apps/desktop/src/main/title-bar.test.ts`
- `apps/desktop/src/renderer/src/platform/desktop-os.ts` — 渲染层平台判断（`isWindowsDesktop()`）。
- `apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.tsx` — 监听主题，把 CSS 变量换算成十六进制发给主进程。
- `apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.test.tsx`
- `apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts` — `singleTabMode` 偏好（zustand persist）。
- `apps/desktop/src/renderer/src/stores/desktop-prefs-store.test.ts`
- `apps/desktop/src/renderer/src/components/appearance-settings-tab.tsx` — 设置页「界面」标签。

修改：
- `apps/desktop/src/main/index.ts` — 两处 `new BrowserWindow` 用 `titleBarOptionsFor`；新增 IPC `window:set-title-bar-overlay`。
- `apps/desktop/src/preload/index.ts`、`apps/desktop/src/preload/index.d.ts` — 暴露 `setTitleBarOverlay`。
- `apps/desktop/src/renderer/src/components/window-toolbar.tsx` — 左侧留白按平台取值。
- `apps/desktop/src/renderer/src/components/desktop-layout.tsx` — 右侧为窗口按钮留白；单页签模式下不渲染 `TabBar`。
- `apps/desktop/src/renderer/src/components/issue-window.tsx` — Windows 上顶部加拖动条。
- `apps/desktop/src/renderer/src/App.tsx` — 挂 `TitleBarOverlaySync`；Ctrl+W 在单页签模式下不关页签。
- `apps/desktop/src/renderer/src/platform/navigation.tsx` + `navigation.test.tsx` — 单页签分流。
- `apps/desktop/src/renderer/src/hooks/use-open-settings-shortcut.ts`、`use-tab-selection-shortcut.ts` 及各自测试。
- `apps/desktop/src/renderer/src/routes.tsx` — 注册「界面」设置标签。
- `packages/views/locales/{en,zh-Hans,zh-Hant,fr,ja,ko}/settings.json` — 新文案键。

---

### Task 1: 主进程标题栏选项纯函数

**Files:**
- Create: `apps/desktop/src/main/title-bar.ts`
- Test: `apps/desktop/src/main/title-bar.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// apps/desktop/src/main/title-bar.test.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERLAY_COLORS,
  parseTitleBarOverlayColors,
  titleBarOptionsFor,
} from "./title-bar";

describe("titleBarOptionsFor", () => {
  it("uses hidden + overlay on Windows for the main window (40px)", () => {
    expect(titleBarOptionsFor("win32", "main")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { ...DEFAULT_OVERLAY_COLORS, height: 40 },
    });
  });

  it("uses a 32px overlay for issue windows on Windows", () => {
    expect(titleBarOptionsFor("win32", "issue")).toEqual({
      titleBarStyle: "hidden",
      titleBarOverlay: { ...DEFAULT_OVERLAY_COLORS, height: 32 },
    });
  });

  it("keeps hiddenInset + traffic light position on macOS", () => {
    expect(titleBarOptionsFor("darwin", "main")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 13 },
    });
    expect(titleBarOptionsFor("darwin", "issue")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 17 },
    });
  });

  it("leaves Linux on the macOS-style options (out of scope, unchanged)", () => {
    expect(titleBarOptionsFor("linux", "main").titleBarStyle).toBe("hiddenInset");
  });
});

describe("parseTitleBarOverlayColors", () => {
  it("accepts 6-digit hex colors", () => {
    expect(
      parseTitleBarOverlayColors({ color: "#f5f5f6", symbolColor: "#6B6B76" }),
    ).toEqual({ color: "#f5f5f6", symbolColor: "#6B6B76" });
  });

  it("rejects anything that is not a plain hex color", () => {
    expect(parseTitleBarOverlayColors({ color: "red", symbolColor: "#000000" })).toBeNull();
    expect(parseTitleBarOverlayColors({ color: "#fff", symbolColor: "#000000" })).toBeNull();
    expect(parseTitleBarOverlayColors(null)).toBeNull();
    expect(parseTitleBarOverlayColors({ color: "#f5f5f6" })).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/main/title-bar.test.ts`
Expected: FAIL，提示找不到模块 `./title-bar`。

- [ ] **Step 3: 实现**

```ts
// apps/desktop/src/main/title-bar.ts
import type { BrowserWindowConstructorOptions } from "electron";

export type WindowKind = "main" | "issue";

export interface TitleBarOverlayColors {
  color: string;
  symbolColor: string;
}

/**
 * First-frame colors for the Windows title bar overlay. The renderer resyncs
 * them from the live theme (see platform/title-bar-overlay-sync.tsx) as soon
 * as it mounts, so these only need to match the light theme's --app-shell /
 * --muted-foreground closely enough to avoid a flash.
 */
export const DEFAULT_OVERLAY_COLORS: TitleBarOverlayColors = {
  color: "#f5f5f6",
  symbolColor: "#78788a",
};

const MAIN_TOP_BAR_HEIGHT = 40; // matches TOP_BAR_HEIGHT_CLASS "h-10"
const ISSUE_DRAG_STRIP_HEIGHT = 32; // matches issue-window.tsx "h-8"

/**
 * `titleBarStyle: "hiddenInset"` is macOS-only; Electron ignores it on
 * Windows and shows the native title bar. On Windows we hide the title bar
 * and let Electron draw the native min/max/close buttons as an overlay inside
 * the renderer's top bar, so the tab strip reaches the window edge.
 */
export function titleBarOptionsFor(
  platform: NodeJS.Platform,
  kind: WindowKind,
): Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
> {
  if (platform === "win32") {
    return {
      titleBarStyle: "hidden",
      titleBarOverlay: {
        ...DEFAULT_OVERLAY_COLORS,
        height: kind === "main" ? MAIN_TOP_BAR_HEIGHT : ISSUE_DRAG_STRIP_HEIGHT,
      },
    };
  }
  return {
    titleBarStyle: "hiddenInset",
    // Center the native controls in the main window's 40px tab toolbar.
    trafficLightPosition: kind === "main" ? { x: 16, y: 13 } : { x: 16, y: 17 },
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Validate the renderer's overlay color payload; null when malformed. */
export function parseTitleBarOverlayColors(
  value: unknown,
): TitleBarOverlayColors | null {
  if (typeof value !== "object" || value === null) return null;
  const { color, symbolColor } = value as Partial<TitleBarOverlayColors>;
  if (typeof color !== "string" || !HEX_COLOR.test(color)) return null;
  if (typeof symbolColor !== "string" || !HEX_COLOR.test(symbolColor)) return null;
  return { color, symbolColor };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `corepack pnpm vitest run src/main/title-bar.test.ts`
Expected: PASS（6 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/main/title-bar.ts src/main/title-bar.test.ts
git commit -m "lilith(desktop): platform-aware title bar options for Windows overlay"
```

---

### Task 2: 主进程接入：窗口创建 + 覆盖层颜色 IPC

**Files:**
- Modify: `apps/desktop/src/main/index.ts`（`createWindow` 约 312-336 行、`createIssueWindow` 约 476-492 行、IPC 注册区约 780 行附近）
- Modify: `apps/desktop/src/preload/index.ts`（`desktopAPI` 对象，`setImmersiveMode` 旁）
- Modify: `apps/desktop/src/preload/index.d.ts`（`DesktopAPI` 接口，`setImmersiveMode` 旁）

- [ ] **Step 1: 主窗口和 issue 窗口改用 `titleBarOptionsFor`**

在 `index.ts` 顶部 import 区加：

```ts
import { parseTitleBarOverlayColors, titleBarOptionsFor } from "./title-bar";
```

`createWindow` 里把

```ts
    titleBarStyle: "hiddenInset",
    // Center the native controls in the main window's 40px tab toolbar.
    trafficLightPosition: { x: 16, y: 13 },
```

替换为

```ts
    ...titleBarOptionsFor(process.platform, "main"),
```

`createIssueWindow` 里把

```ts
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 17 },
```

替换为

```ts
    ...titleBarOptionsFor(process.platform, "issue"),
```

- [ ] **Step 2: 注册 IPC `window:set-title-bar-overlay`**

在 `ipcMain.handle("window:setImmersive", ...)` 之后加：

```ts
    // IPC: the renderer resyncs the Windows title bar overlay (native
    // min/max/close buttons) to the live theme. No-op elsewhere.
    ipcMain.on("window:set-title-bar-overlay", (_event, payload: unknown) => {
      if (process.platform !== "win32") return;
      const colors = parseTitleBarOverlayColors(payload);
      if (!colors) return;
      for (const target of BrowserWindow.getAllWindows()) {
        if (target.isDestroyed()) continue;
        try {
          target.setTitleBarOverlay(colors);
        } catch {
          // Windows created without an overlay (none today) throw; ignore.
        }
      }
    });
```

- [ ] **Step 3: preload 暴露 `setTitleBarOverlay`**

`src/preload/index.ts` 的 `desktopAPI` 对象里，`setImmersiveMode` 之后加：

```ts
  setTitleBarOverlay: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.send("window:set-title-bar-overlay", colors),
```

`src/preload/index.d.ts` 的 `DesktopAPI` 接口里，`setImmersiveMode` 之后加：

```ts
  /** Windows only: recolor the native window-control overlay to match the theme. */
  setTitleBarOverlay: (colors: { color: string; symbolColor: string }) => void;
```

- [ ] **Step 4: 类型检查**

Run: `corepack pnpm typecheck`
Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/main/index.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "lilith(desktop): hide native title bar on Windows, expose overlay recolor IPC"
```

---

### Task 3: 渲染层平台判断 + 顶栏左右留白

**Files:**
- Create: `apps/desktop/src/renderer/src/platform/desktop-os.ts`
- Modify: `apps/desktop/src/renderer/src/components/window-toolbar.tsx:40-41,177-183,260-268`
- Modify: `apps/desktop/src/renderer/src/components/desktop-layout.tsx:73-108`（`MainTopBar`）
- Modify: `apps/desktop/src/renderer/src/components/issue-window.tsx:95-101`

- [ ] **Step 1: 平台判断辅助**

```ts
// apps/desktop/src/renderer/src/platform/desktop-os.ts
/**
 * Renderer-side OS check. `desktopAPI` is absent in some unit tests, so this
 * degrades to "not Windows" (the macOS layout) instead of throwing.
 */
export function isWindowsDesktop(): boolean {
  return window.desktopAPI?.appInfo?.os === "windows";
}

/** Width reserved on the right of the top bar for the native overlay buttons. */
export const WINDOWS_CONTROLS_CLEARANCE = 138;
```

- [ ] **Step 2: `window-toolbar.tsx` 左侧留白按平台取值**

把

```ts
const TRAFFIC_LIGHT_CLEARANCE = 88;
export const WINDOW_TOOLBAR_CLEARANCE = 200;
```

改成

```ts
import { isWindowsDesktop } from "@/platform/desktop-os";

// macOS: leave room for the traffic lights; Windows: plain left padding.
function leadingClearance(): number {
  return isWindowsDesktop() ? 12 : 88;
}
// Total width of the toolbar (clearance + back/forward/sidebar buttons).
export function windowToolbarClearance(): number {
  return isWindowsDesktop() ? 124 : 200;
}
```

`WindowToolbar` 内把

```ts
  const toolbarWidth: React.CSSProperties["width"] = sidebarHidden
    ? WINDOW_TOOLBAR_CLEARANCE
    : `max(var(--sidebar-live-width, var(--sidebar-width)), ${WINDOW_TOOLBAR_CLEARANCE}px)`;
```

改成

```ts
  const clearance = windowToolbarClearance();
  const toolbarWidth: React.CSSProperties["width"] = sidebarHidden
    ? clearance
    : `max(var(--sidebar-live-width, var(--sidebar-width)), ${clearance}px)`;
```

把 `paddingLeft: TRAFFIC_LIGHT_CLEARANCE,` 改成 `paddingLeft: leadingClearance(),`。

- [ ] **Step 3: `desktop-layout.tsx` 的 `MainTopBar`**

import 处把 `import { WindowToolbar, WINDOW_TOOLBAR_CLEARANCE } from "./window-toolbar";` 改成

```ts
import { WindowToolbar, windowToolbarClearance } from "./window-toolbar";
import { isWindowsDesktop, WINDOWS_CONTROLS_CLEARANCE } from "@/platform/desktop-os";
```

`MainTopBar` 函数体改成：

```tsx
function MainTopBar({ sidebarMounted }: { sidebarMounted: boolean }) {
  const { state, isCompact } = useSidebar();
  const sidebarHidden = !sidebarMounted || state === "collapsed" || isCompact;
  const clearance = windowToolbarClearance();
  const toolbarClearance: React.CSSProperties["paddingLeft"] = sidebarHidden
    ? clearance
    : `max(0px, calc(${clearance}px - var(--sidebar-live-width, var(--sidebar-width))))`;
  // Windows draws the native window buttons over the top-right corner; keep
  // tabs and the "+" button out from under them. The drag region still
  // extends to the edge so the strip stays grabbable.
  const controlsClearance = isWindowsDesktop() ? WINDOWS_CONTROLS_CLEARANCE : 0;

  return (
    <header
      data-slot="main-top-bar"
      data-sidebar-resize-consumer
      className={cn(
        "relative shrink-0 flex items-center gap-2 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none",
        TOP_BAR_HEIGHT_CLASS,
      )}
      style={{ paddingLeft: toolbarClearance, paddingRight: controlsClearance }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 right-0"
        style={
          {
            left: toolbarClearance,
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      />
      <div
        data-slot="main-top-bar-content"
        className="relative z-10 flex h-full min-w-0 max-w-full items-center"
      >
        <TabBar />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: issue 窗口顶部拖动条**

`issue-window.tsx` 第 97 行附近的容器

```tsx
      className="flex h-screen min-h-0 flex-col bg-page-canvas text-foreground"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
```

改成

```tsx
      className="flex h-screen min-h-0 flex-col bg-page-canvas text-foreground"
    >
      {isWindowsDesktop() && (
        // Windows: the native window buttons overlay this strip (see
        // main/title-bar.ts, 32px); it doubles as the drag region.
        <div
          aria-hidden
          className="h-8 shrink-0 bg-page-canvas"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
```

并在文件顶部加 `import { isWindowsDesktop } from "@/platform/desktop-os";`。

- [ ] **Step 5: 跑相关测试和类型检查**

Run: `corepack pnpm vitest run src/renderer/src/components/window-toolbar.test.tsx src/renderer/src/components/desktop-layout.test.tsx src/renderer/src/components/issue-window.test.tsx && corepack pnpm typecheck`
Expected: 全部 PASS（这些测试没有 `desktopAPI.appInfo`，走 macOS 分支，行为不变）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/platform/desktop-os.ts src/renderer/src/components/window-toolbar.tsx src/renderer/src/components/desktop-layout.tsx src/renderer/src/components/issue-window.tsx
git commit -m "lilith(desktop): Windows top bar clearances for overlay window controls"
```

---

### Task 4: 覆盖层颜色随主题同步

**Files:**
- Create: `apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.tsx`
- Test: `apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.test.tsx`
- Modify: `apps/desktop/src/renderer/src/App.tsx:455-457`（`<ThemeProvider>` 内第一行）

- [ ] **Step 1: 写失败的测试**

```tsx
// apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const theme = vi.hoisted(() => ({ resolvedTheme: "light" as string | undefined }));
vi.mock("@multica/ui/components/common/theme-provider", () => ({
  useTheme: () => theme,
}));

import { TitleBarOverlaySync, resolveOverlayColors } from "./title-bar-overlay-sync";

describe("resolveOverlayColors", () => {
  it("normalizes CSS variable colors to 6-digit hex via canvas", () => {
    const ctx = { fillStyle: "" };
    const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
    const read = (name: string) =>
      name === "--app-shell" ? "rgb(245, 245, 246)" : "rgb(120, 120, 138)";
    // jsdom's canvas stub does not normalize; emulate Chromium's behavior.
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        this._v = v === "rgb(245, 245, 246)" ? "#f5f5f6" : "#78788a";
      },
      get() {
        return this._v;
      },
    });
    expect(resolveOverlayColors(read, canvas)).toEqual({
      color: "#f5f5f6",
      symbolColor: "#78788a",
    });
  });

  it("returns null when the canvas cannot normalize to hex", () => {
    const ctx = { fillStyle: "" };
    const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
    expect(resolveOverlayColors(() => "", canvas)).toBeNull();
  });
});

describe("TitleBarOverlaySync", () => {
  const setTitleBarOverlay = vi.fn();
  beforeEach(() => {
    setTitleBarOverlay.mockReset();
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { appInfo: { os: "windows", version: "x" }, setTitleBarOverlay },
    });
  });

  it("sends colors on mount and again when the theme changes", () => {
    const colors = { color: "#f5f5f6", symbolColor: "#78788a" };
    const { rerender } = render(<TitleBarOverlaySync resolve={() => colors} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(1);
    expect(setTitleBarOverlay).toHaveBeenCalledWith(colors);
    theme.resolvedTheme = "dark";
    rerender(<TitleBarOverlaySync resolve={() => colors} />);
    expect(setTitleBarOverlay).toHaveBeenCalledTimes(2);
  });

  it("does nothing off Windows", () => {
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { appInfo: { os: "macos", version: "x" }, setTitleBarOverlay },
    });
    render(<TitleBarOverlaySync resolve={() => ({ color: "#000000", symbolColor: "#ffffff" })} />);
    expect(setTitleBarOverlay).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/renderer/src/platform/title-bar-overlay-sync.test.tsx`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现**

```tsx
// apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.tsx
import { useEffect } from "react";
import { useTheme } from "@multica/ui/components/common/theme-provider";
import { isWindowsDesktop } from "./desktop-os";

export interface OverlayColors {
  color: string;
  symbolColor: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Read `--app-shell` / `--muted-foreground` and normalize them to `#rrggbb`.
 * The tokens are `oklch(...)`, which `titleBarOverlay` does not accept;
 * assigning any CSS color to a 2D canvas `fillStyle` and reading it back
 * yields the normalized hex form for opaque colors.
 */
export function resolveOverlayColors(
  readVariable: (name: string) => string = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): OverlayColors | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const toHex = (value: string): string | null => {
    if (!value) return null;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const out = String(ctx.fillStyle);
    return HEX_COLOR.test(out) ? out : null;
  };
  const color = toHex(readVariable("--app-shell"));
  const symbolColor = toHex(readVariable("--muted-foreground"));
  if (!color || !symbolColor) return null;
  return { color, symbolColor };
}

/**
 * Keeps the Windows native window-control overlay on the same background as
 * the top bar. Runs once on mount (first frame) and on every resolved theme
 * change (light/dark/system flips).
 */
export function TitleBarOverlaySync({
  resolve = resolveOverlayColors,
}: {
  resolve?: () => OverlayColors | null;
}) {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!isWindowsDesktop()) return;
    // next-themes applies the `.dark` class in an effect too; defer one frame
    // so the computed variables reflect the new theme.
    const frame = requestAnimationFrame(() => {
      const colors = resolve();
      if (colors) window.desktopAPI.setTitleBarOverlay(colors);
    });
    return () => cancelAnimationFrame(frame);
  }, [resolve, resolvedTheme]);
  return null;
}
```

测试里 `requestAnimationFrame` 在 jsdom 是异步的；在测试文件顶部加：

```ts
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 1; });
vi.stubGlobal("cancelAnimationFrame", () => {});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `corepack pnpm vitest run src/renderer/src/platform/title-bar-overlay-sync.test.tsx`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 挂到 App**

`App.tsx` import 区加 `import { TitleBarOverlaySync } from "@/platform/title-bar-overlay-sync";`，把

```tsx
    <ThemeProvider>
      {runtimeConfigResult.ok ? (
```

改成

```tsx
    <ThemeProvider>
      <TitleBarOverlaySync />
      {runtimeConfigResult.ok ? (
```

- [ ] **Step 6: 类型检查并提交**

Run: `corepack pnpm typecheck`
Expected: 无错误。

```bash
git add src/renderer/src/platform/title-bar-overlay-sync.tsx src/renderer/src/platform/title-bar-overlay-sync.test.tsx src/renderer/src/App.tsx
git commit -m "lilith(desktop): sync Windows title bar overlay colors with theme"
```

---

### Task 5: 单页签模式偏好 store

**Files:**
- Create: `apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts`
- Test: `apps/desktop/src/renderer/src/stores/desktop-prefs-store.test.ts`

- [ ] **Step 1: 写失败的测试**

```ts
// apps/desktop/src/renderer/src/stores/desktop-prefs-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { useDesktopPrefsStore, isSingleTabMode } from "./desktop-prefs-store";

beforeEach(() => {
  localStorage.clear();
  useDesktopPrefsStore.setState({ singleTabMode: false });
});

describe("desktop prefs store", () => {
  it("defaults singleTabMode to false", () => {
    expect(useDesktopPrefsStore.getState().singleTabMode).toBe(false);
    expect(isSingleTabMode()).toBe(false);
  });

  it("toggles and persists under multica_desktop_prefs", () => {
    useDesktopPrefsStore.getState().setSingleTabMode(true);
    expect(isSingleTabMode()).toBe(true);
    const raw = JSON.parse(localStorage.getItem("multica_desktop_prefs") ?? "{}");
    expect(raw.state.singleTabMode).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/renderer/src/stores/desktop-prefs-store.test.ts`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现**

```ts
// apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Desktop-only UI preferences. Renderer-local (localStorage) because every
 * consumer lives in the renderer; nothing in main needs them.
 */
interface DesktopPrefsStore {
  /** Hide the tab strip and route every "open in new tab" in place. */
  singleTabMode: boolean;
  setSingleTabMode: (enabled: boolean) => void;
}

export const useDesktopPrefsStore = create<DesktopPrefsStore>()(
  persist(
    (set) => ({
      singleTabMode: false,
      setSingleTabMode: (enabled) => set({ singleTabMode: enabled }),
    }),
    { name: "multica_desktop_prefs", version: 1 },
  ),
);

/** Non-hook read for imperative call sites (navigation adapter, shortcuts). */
export function isSingleTabMode(): boolean {
  return useDesktopPrefsStore.getState().singleTabMode;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `corepack pnpm vitest run src/renderer/src/stores/desktop-prefs-store.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/stores/desktop-prefs-store.ts src/renderer/src/stores/desktop-prefs-store.test.ts
git commit -m "lilith(desktop): desktop prefs store with singleTabMode"
```

---

### Task 6: 导航层单页签分流

**Files:**
- Modify: `apps/desktop/src/renderer/src/platform/navigation.tsx:105-128,140-151,196-205,228-243`
- Test: `apps/desktop/src/renderer/src/platform/navigation.test.tsx`（追加 describe）

- [ ] **Step 1: 追加失败的测试**

在 `navigation.test.tsx` 末尾追加：

```tsx
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

describe("single-tab mode", () => {
  beforeEach(() => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
  });
  afterEach(() => {
    useDesktopPrefsStore.setState({ singleTabMode: false });
  });

  it("openInNewTab navigates the active session instead of adding a tab", () => {
    const getAdapter = renderProvider();
    getAdapter().openInNewTab!("/acme/agents", "Agents", { activate: true });
    const group = acmeGroup();
    expect(group.tabs).toHaveLength(1);
    expect(getActiveTab(useTabStore.getState())?.url).toBe("/acme/agents");
  });

  it("openInNewTab still switches workspace for a cross-workspace path", () => {
    const getAdapter = renderProvider();
    getAdapter().openInNewTab!("/butter/inbox");
    expect(useTabStore.getState().activeWorkspaceSlug).toBe("butter");
  });

  it("push from a pinned tab stays in that tab", () => {
    renderProvider();
    const store = useTabStore.getState();
    store.togglePin(getActiveTab(store)!.id);
    const getAdapter = renderProvider();
    getAdapter().push("/acme/projects");
    const group = acmeGroup();
    expect(group.tabs).toHaveLength(1);
    expect(group.tabs[0].url).toBe("/acme/projects");
  });

  it("content links with a modifier disposition navigate in place", () => {
    renderProvider();
    routeContentLinkPath("/acme/agents", "background-tab");
    expect(acmeGroup().tabs).toHaveLength(1);
    expect(getActiveTab(useTabStore.getState())?.url).toBe("/acme/agents");
  });
});
```


- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/renderer/src/platform/navigation.test.tsx -t "single-tab mode"`
Expected: 4 个 FAIL（页签数为 2 而不是 1）。

- [ ] **Step 3: 实现分流**

`navigation.tsx` import 区加：

```ts
import { isSingleTabMode } from "@/stores/desktop-prefs-store";
```

`routeContentLinkPath` 改成：

```ts
export function routeContentLinkPath(
  path: string,
  disposition: LinkClickIntent = "push",
): void {
  const store = useTabStore.getState();
  const slug = workspaceSlugForPath(path);
  if (slug && slug !== store.activeWorkspaceSlug) {
    store.switchWorkspace(slug, path);
    return;
  }
  // Single-tab mode: there is nowhere else to open; every disposition is a push.
  if (disposition === "push" || isSingleTabMode()) {
    const active = getActiveTab(store);
    if (active && active.url === path) return;
    if (tryRouteToPinnedNewTab(path)) return;
    store.navigateActiveSession(path);
    return;
  }
  // Empty seed title — the tab bar derives the real title from the URL and
  // cache; a raw path would flash before that resolves.
  store.openTab(path, "", { activate: disposition === "foreground-tab" });
}
```

`tryRouteToPinnedNewTab` 开头加一行：

```ts
function tryRouteToPinnedNewTab(path: string): boolean {
  if (isSingleTabMode()) return false;
  const store = useTabStore.getState();
```

adapter 的 `openInNewTab` 中，把

```ts
        store.openTab(path, title ?? "", { activate: opts?.activate });
```

改成

```ts
        if (isSingleTabMode()) {
          // Single-tab mode: "open in new tab" means "go there" — same
          // dedupe/no-op rules as push.
          const active = getActiveTab(store);
          if (active && active.url === path) return;
          store.navigateActiveSession(path);
          return;
        }
        store.openTab(path, title ?? "", { activate: opts?.activate });
```

- [ ] **Step 4: 跑全部导航测试**

Run: `corepack pnpm vitest run src/renderer/src/platform/navigation.test.tsx`
Expected: 全部 PASS（原有用例因 `singleTabMode` 默认 false 不受影响）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/platform/navigation.tsx src/renderer/src/platform/navigation.test.tsx
git commit -m "lilith(desktop): route new-tab navigation in place under single-tab mode"
```

---

### Task 7: 三个快捷键在单页签模式下的行为

**Files:**
- Modify: `apps/desktop/src/renderer/src/hooks/use-open-settings-shortcut.ts:18-26`
- Modify: `apps/desktop/src/renderer/src/hooks/use-tab-selection-shortcut.ts:16-29`
- Modify: `apps/desktop/src/renderer/src/App.tsx:62-85`（`useCmdWCloseTab`）
- Test: `apps/desktop/src/renderer/src/hooks/use-open-settings-shortcut.test.tsx`、`use-tab-selection-shortcut.test.tsx`（各追加一个用例）

- [ ] **Step 1: 追加失败的测试**

`use-open-settings-shortcut.test.tsx` 已有 `seedTabs()`、`tabUrls()`、`activeTabUrl()` 辅助函数和 `describe("openSettingsTab")`，在该 describe 内追加：

```tsx
  it("single-tab mode: navigates the active tab to settings instead of opening one", () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    try {
      openSettingsTab();
      expect(tabUrls()).toEqual(["/acme/settings"]);
      expect(activeTabUrl()).toBe("/acme/settings");
    } finally {
      useDesktopPrefsStore.setState({ singleTabMode: false });
    }
  });
```

文件顶部加 `import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";`。

`use-tab-selection-shortcut.test.tsx` 末尾追加（直接操作真实 store）：

```tsx
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

describe("single-tab mode", () => {
  it("Cmd/Ctrl+N does not switch tabs", () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    try {
      const store = useTabStore.getState();
      store.reset();
      store.switchWorkspace("acme");
      store.openTab("/acme/agents", "", { activate: false });
      const before = useTabStore.getState().byWorkspace.acme.activeTabId;
      selectTabByShortcut(2);
      expect(useTabStore.getState().byWorkspace.acme.activeTabId).toBe(before);
    } finally {
      useDesktopPrefsStore.setState({ singleTabMode: false });
    }
  });
});
```

若该文件已 mock 了 `@/stores/tab-store`，改为对 mock 的 `setActiveTab` 断言 `not.toHaveBeenCalled()`。

- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/renderer/src/hooks/use-open-settings-shortcut.test.tsx src/renderer/src/hooks/use-tab-selection-shortcut.test.tsx`
Expected: 新增的 2 个用例 FAIL。

- [ ] **Step 3: 实现**

`use-open-settings-shortcut.ts`：

```ts
import { isSingleTabMode } from "@/stores/desktop-prefs-store";

export function openSettingsTab(): void {
  if (useWindowOverlayStore.getState().overlay) return;
  const store = useTabStore.getState();
  const slug = store.activeWorkspaceSlug;
  if (!slug) return;
  const target = paths.workspace(slug).settings();
  if (isSingleTabMode()) {
    // No tab strip to open into: go there in the (only visible) tab.
    store.navigateActiveSession(target);
    return;
  }
  // Empty seed title: the tab bar derives the real one from the URL, same as
  // every other programmatic openTab caller.
  store.openTab(target, "", { activate: true });
}
```

`use-tab-selection-shortcut.ts` 的 `selectTabByShortcut` 开头：

```ts
import { isSingleTabMode } from "@/stores/desktop-prefs-store";

export function selectTabByShortcut(key: TabSelectionShortcutKey): void {
  if (useWindowOverlayStore.getState().overlay) return;
  // Single-tab mode hides the strip; switching to an invisible tab would be
  // a silent surprise.
  if (isSingleTabMode()) return;
```

`App.tsx` 的 `useCmdWCloseTab`：在 `const group = byWorkspace[activeWorkspaceSlug];` 之前加

```ts
      // Single-tab mode: Cmd/Ctrl+W neither closes the only visible page nor
      // the window — ignore it, like a browser with the strip disabled.
      if (isSingleTabMode()) return;
```

并 import `isSingleTabMode`。

- [ ] **Step 4: 跑测试确认通过**

Run: `corepack pnpm vitest run src/renderer/src/hooks/ && corepack pnpm typecheck`
Expected: 全部 PASS，无类型错误。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/hooks/use-open-settings-shortcut.ts src/renderer/src/hooks/use-open-settings-shortcut.test.tsx src/renderer/src/hooks/use-tab-selection-shortcut.ts src/renderer/src/hooks/use-tab-selection-shortcut.test.tsx src/renderer/src/App.tsx
git commit -m "lilith(desktop): tab shortcuts respect single-tab mode"
```

---

### Task 8: 顶栏隐藏页签条

**Files:**
- Modify: `apps/desktop/src/renderer/src/components/desktop-layout.tsx`（Task 3 改过的 `MainTopBar`）
- Test: `apps/desktop/src/renderer/src/components/desktop-layout.test.tsx`（追加一个用例）

- [ ] **Step 1: 追加失败的测试**

`desktop-layout.test.tsx` 第 80 行把 `TabBar` mock 成 `() => null`，改成带标记的占位：

```tsx
vi.mock("./tab-bar", () => ({ TabBar: () => <div data-testid="tab-bar" /> }));
```

然后追加（用文件里现有的 `renderShell()`）：

```tsx
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

describe("single-tab mode", () => {
  afterEach(() => useDesktopPrefsStore.setState({ singleTabMode: false }));

  it("renders the tab bar by default", async () => {
    renderShell();
    expect(await screen.findByTestId("tab-bar")).toBeInTheDocument();
  });

  it("hides the tab bar but keeps the top bar when enabled", async () => {
    useDesktopPrefsStore.setState({ singleTabMode: true });
    renderShell();
    expect(await screen.findByTestId("main-top-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-bar")).toBeNull();
  });
});
```

`MainTopBar` 的 `<header>` 加 `data-testid="main-top-bar"`（Task 3 的代码基础上）。若文件没有 import `screen` / `afterEach`，补上。

- [ ] **Step 2: 跑测试确认失败**

Run: `corepack pnpm vitest run src/renderer/src/components/desktop-layout.test.tsx -t "single-tab"`
Expected: FAIL。

- [ ] **Step 3: 实现**

`desktop-layout.tsx` import 区加 `import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";`。`MainTopBar` 里加

```tsx
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
```

并把 `<TabBar />` 改成 `{!singleTabMode && <TabBar />}`。顶栏其余部分（高度、拖动区、左右留白）不变，所以 Windows 窗口按钮和前进 / 后退仍在原位。

- [ ] **Step 4: 跑测试确认通过**

Run: `corepack pnpm vitest run src/renderer/src/components/desktop-layout.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/components/desktop-layout.tsx src/renderer/src/components/desktop-layout.test.tsx
git commit -m "lilith(desktop): hide tab strip in single-tab mode"
```

---

### Task 9: 设置页「界面」标签 + 文案

**Files:**
- Create: `apps/desktop/src/renderer/src/components/appearance-settings-tab.tsx`
- Modify: `apps/desktop/src/renderer/src/routes.tsx:35-66`
- Modify: `packages/views/locales/en/settings.json`（`desktop.tabs`、新增 `desktop.appearance`）
- Modify: `packages/views/locales/zh-Hans/settings.json`、`zh-Hant/settings.json`、`fr/settings.json`、`ja/settings.json`、`ko/settings.json`（同样的键）

- [ ] **Step 1: 文案**

`en/settings.json` 的 `"desktop"` 段：`"tabs"` 里加 `"appearance": "Appearance"`，并在 `"tab_bar"` 前加：

```json
    "appearance": {
      "title": "Appearance",
      "single_tab_mode_title": "Single-tab mode",
      "single_tab_mode_description": "Hide the tab strip. Links, Ctrl+click and pinned-tab navigation all open in the current page; back and forward keep working. Existing tabs are kept and return when you turn this off."
    },
```

`zh-Hans`：`"appearance": "界面"`，段落：

```json
    "appearance": {
      "title": "界面",
      "single_tab_mode_title": "单页签模式",
      "single_tab_mode_description": "隐藏页签栏。链接、Ctrl+点击和固定页签的跳转都在当前页打开；前进 / 后退照常。已有页签会保留，关闭此开关后恢复显示。"
    },
```

`zh-Hant`：`"appearance": "介面"`，段落用繁体：

```json
    "appearance": {
      "title": "介面",
      "single_tab_mode_title": "單分頁模式",
      "single_tab_mode_description": "隱藏分頁列。連結、Ctrl+點擊和固定分頁的跳轉都在目前頁面開啟；上一頁 / 下一頁照常。既有分頁會保留，關閉此開關後恢復顯示。"
    },
```

`fr`、`ja`、`ko` 三个文件加同名键，值先用英文文案（与 en 相同）。

- [ ] **Step 2: 设置标签组件**

```tsx
// apps/desktop/src/renderer/src/components/appearance-settings-tab.tsx
import { Switch } from "@multica/ui/components/ui/switch";
import { useT } from "@multica/views/i18n";
import { SettingsCard, SettingsRow, SettingsTab } from "@multica/views/settings";
import { useDesktopPrefsStore } from "@/stores/desktop-prefs-store";

export function AppearanceSettingsTab() {
  const { t } = useT("settings");
  const singleTabMode = useDesktopPrefsStore((s) => s.singleTabMode);
  const setSingleTabMode = useDesktopPrefsStore((s) => s.setSingleTabMode);

  return (
    <SettingsTab title={t(($) => $.desktop.appearance.title)}>
      <SettingsCard>
        <SettingsRow
          label={t(($) => $.desktop.appearance.single_tab_mode_title)}
          description={t(($) => $.desktop.appearance.single_tab_mode_description)}
        >
          <Switch
            checked={singleTabMode}
            onCheckedChange={setSingleTabMode}
            aria-label={t(($) => $.desktop.appearance.single_tab_mode_title)}
          />
        </SettingsRow>
      </SettingsCard>
    </SettingsTab>
  );
}
```

- [ ] **Step 3: 注册标签**

`routes.tsx`：import 区 `import { Download, Server } from "lucide-react";` 改成 `import { Download, PanelTop, Server } from "lucide-react";`，加 `import { AppearanceSettingsTab } from "./components/appearance-settings-tab";`。`extraDeviceTabs` 数组开头插入：

```tsx
        {
          value: "appearance",
          label: t(($) => $.desktop.tabs.appearance),
          icon: PanelTop,
          content: <AppearanceSettingsTab />,
        },
```

- [ ] **Step 4: 类型检查 + 文案一致性测试 + 全量单测**

Run: `corepack pnpm typecheck && (cd ../../packages/views && corepack pnpm vitest run locales) && corepack pnpm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/src/components/appearance-settings-tab.tsx src/renderer/src/routes.tsx ../../packages/views/locales
git commit -m "lilith(desktop): Appearance settings tab with single-tab mode switch"
```

---

### Task 10: 开发模式实机预览

**Files:** 无代码改动；用于人工验收。

- [ ] **Step 1: 补 Electron 开发二进制**（pnpm 安装时被跳过）

Run（在 `E:\code\multica` 仓库根目录）: `node node_modules/electron/install.js && ls node_modules/electron/dist/electron.exe`
Expected: 打印 `node_modules/electron/dist/electron.exe`。

- [ ] **Step 2: 启动开发模式，指向内网服务器**

开发模式不读 `~/.multica/desktop.json`，运行时配置来自环境变量：

```bash
cd /e/code/multica/apps/desktop
export PATH="/c/Program Files/Go/bin:$PATH"
VITE_API_URL=http://zengine-multica.lilithgames.com VITE_APP_URL=http://zengine-multica.lilithgames.com corepack pnpm dev
```

开发实例叫「Multica Canary」，userData 与正式版分开，需要重新登录一次；守护进程 profile 与正式版相同，若正式版 Desktop 正在跑，开发实例会复用它已启动的守护进程，不要在开发实例里点「停止守护进程」。

- [ ] **Step 3: 验收清单（Windows）**

1. 无原生标题栏；页签栏贴窗口顶边；右上角三个系统按钮背景与页签栏同色。
2. 拖页签栏移动窗口、双击最大化、悬停最大化按钮出现分屏菜单。
3. 设置 → 外观切换深浅色，按钮区颜色跟随（允许一帧延迟）。
4. 页签栏左侧无 88px 空白，前进 / 后退紧贴左边。
5. 设置 → 界面 → 打开「单页签模式」：页签栏消失；Ctrl+点击 issue 链接在当前页打开；Ctrl+2 无反应；Ctrl+W 无反应；前进 / 后退正常。
6. 关闭开关：页签栏和之前的页签全部恢复。
7. 右键 issue →「在新窗口打开」：弹出窗口顶部有 32px 同色拖动条，无原生标题栏。

发现问题就修并补测试后回到本步骤；外观上要不要把顶条改成和页面同色，在这一步和用户确认后另开任务。

---

### Task 11: 打包发布 v0.7.1-lilith.3

- [ ] **Step 1: 全量测试 + 类型检查**

Run: `corepack pnpm test && corepack pnpm typecheck`
Expected: 全部 PASS。

- [ ] **Step 2: 打 tag 并打包**

```bash
cd /e/code/multica && git tag v0.7.1-lilith.3 && git push origin lilith/main v0.7.1-lilith.3
cd apps/desktop && export PATH="/c/Program Files/Go/bin:$PATH" && corepack pnpm run package -- --win --x64 --publish never
ls dist/multica-desktop-0.7.1-lilith.3-windows-x64.exe dist/latest.yml
```

Expected: 三个产物（exe、exe.blockmap、latest.yml），`latest.yml` 的 `version: 0.7.1-lilith.3`。

- [ ] **Step 3: 发 Release**

```bash
mkdir -p /e/backup/lilith-releases/v0.7.1-lilith.3 && cp dist/multica-desktop-0.7.1-lilith.3-windows-x64.exe* dist/latest.yml /e/backup/lilith-releases/v0.7.1-lilith.3/
export PATH="/c/Program Files/GitHub CLI:$PATH"
gh release create v0.7.1-lilith.3 --repo zjulzy/multica --title "v0.7.1-lilith.3" --notes "Windows 去掉原生标题栏（窗口按钮嵌入页签栏、颜色随主题）；新增设置 → 界面 → 单页签模式。" --prerelease --latest=false dist/multica-desktop-0.7.1-lilith.3-windows-x64.exe dist/multica-desktop-0.7.1-lilith.3-windows-x64.exe.blockmap dist/latest.yml
```

- [ ] **Step 4: 客户端内升级验证**

正式版 Desktop：设置 → Updates → 检查更新，下载完成后重启；验证 `multica.exe version` 输出 `0.7.1-lilith.3`，标题栏和单页签模式与开发模式表现一致。
