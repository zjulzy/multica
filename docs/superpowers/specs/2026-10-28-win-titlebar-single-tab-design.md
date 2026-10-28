# Multica Desktop 魔改 v1：Windows 标题栏融合 + 单页签模式

日期：2026-10-28  分支：`lilith/main`  目标版本：`v0.7.1-lilith.3`

## 背景

Desktop 主窗口用 `titleBarStyle: "hiddenInset"` 隐藏标题栏，这个值只对 macOS 生效。
Windows 上原生标题栏（白底、应用图标、页面标题）原样留在应用顶部，与下方灰色页签栏割裂。
页签栏左侧还为 macOS 红绿灯留了 88px 空位，在 Windows 上是无意义的空白。

另外用户几乎不用多页签，希望有一个开关把页签栏藏掉、所有导航都在当前页进行。

## 范围

做：
1. Windows 上去掉原生标题栏，窗口按钮以覆盖层形式嵌入页签栏右侧，颜色随主题。
2. 「单页签模式」开关：藏页签栏，所有开新页签的路径改为当前页跳转。

不做：
- Linux 适配（同样受 `hiddenInset` 影响，但不在本次范围）。
- 页签栏与页面同色（之前讨论的 B 方案）。v1 先保持灰色顶条，预览后再定。
- VS Code 式预览页签。

## 功能一：Windows 标题栏融合

### 主进程（`apps/desktop/src/main/index.ts`）

- 主窗口和 issue 弹出窗口：`process.platform === "win32"` 时改用
  `titleBarStyle: "hidden"` + `titleBarOverlay: { color, symbolColor, height }`。
  macOS 保持 `hiddenInset` 不变。
- `height` 与渲染层顶栏一致：主窗口 40px（`TOP_BAR_HEIGHT_CLASS = "h-10"`）。
  issue 弹出窗口没有自己的顶栏（`issue-window.tsx` 直接铺页面），Windows 上在页面顶部加一条
  32px、`bg-page-canvas` 的拖动条，覆盖层 `height` 取 32，按钮落在这条里，不压住 issue 标题。
- 覆盖层颜色取自主题变量 `--app-shell`（浅色 `oklch(96.44% .0013 286.375)`、深色 `oklch(15.5% .005 285.823)`），
  渲染层在运行时用 `getComputedStyle(document.documentElement).getPropertyValue("--app-shell")` 读出并转成
  十六进制发给主进程，不在代码里写死颜色；`symbolColor` 取 `--muted-foreground`。主进程创建窗口时的
  初始值用浅色主题的十六进制常量，首帧后由渲染层同步纠正。
- 新增 IPC `window:set-title-bar-overlay`（渲染层 → 主进程），参数 `{ color, symbolColor }`，
  主进程对所有已打开窗口调用 `setTitleBarOverlay`。非 Windows 平台忽略。

### 渲染层

- 顶栏（`desktop-layout.tsx` 的 `MainTopBar`）和 `window-toolbar.tsx`：
  - Windows 上左侧不再为红绿灯留 88px，导航按钮从左边缘起（保留正常内边距）。
  - Windows 上右侧为覆盖层按钮预留固定宽度（约 138px，三个按钮各 46px），
    页签栏、「+」按钮和溢出区域不得伸进这块区域；该区域保持拖动。
- 主题同步：在 `App.tsx` 的 `ThemeProvider` 内加一个小组件，监听 `useTheme().resolvedTheme`，
  变化时通过 preload 新增的 `desktopAPI.setTitleBarOverlay` 发送上面的 IPC。
  启动时发一次，保证首帧颜色正确。
- 平台判断用 `window.desktopAPI.appInfo.os === "windows"`（preload 已暴露）。

### 不变量

- 页签栏仍是窗口拖动区；双击最大化、Win+方向键、悬停最大化按钮弹出的分屏菜单均由系统提供，无需处理。
- 窗口状态持久化（`window-state`）不受影响。

## 功能二：单页签模式

### 设置与持久化

- 新增渲染层偏好 store `desktop-prefs-store.ts`（zustand + persist，localStorage 键 `multica_desktop_prefs`），
  字段 `singleTabMode: boolean`，默认 `false`。
- 设置页（`routes.tsx` 的 `extraDeviceTabs`）新增「界面」标签（图标 `PanelTop`），
  内含一个开关「单页签模式」及一句说明。文案走 `@multica/views` 的 i18n，
  补 `settings.desktop.appearance.*` 的中英文键。

### 开启时的行为

| 入口 | 现状 | 单页签模式 |
|---|---|---|
| `TabBar` | 渲染在顶栏 | 不渲染；顶栏高度不变（40px），仅保留导航按钮、侧栏开关和拖动区 |
| `adapter.push` | 钉住页签时强制开新页签 | 跳过 `tryRouteToPinnedNewTab`，直接 `navigateActiveSession` |
| `adapter.openInNewTab`（同工作区） | `openTab` | `navigateActiveSession(path)`；跨工作区仍 `switchWorkspace` |
| `routeContentLinkPath` 的 `background-tab` / `foreground-tab` | `openTab` | 当作 `push` 处理 |
| `use-open-settings-shortcut` 的 `openTab` | 开或切到设置页签 | `navigateActiveSession(settings)` |
| `use-tab-selection-shortcut`（Ctrl+数字切页签） | 切页签 | 不响应 |
| 主进程菜单 `tab:close-active`（Ctrl+W） | 关闭当前页签 | 不响应（不关唯一可见的页） |
| 前进 / 后退 | 页签内历史 | 不变 |

- 实现方式：在 `navigation.tsx` 的 adapter 和 `routeContentLinkPath` 里读取 store 的 `singleTabMode`，
  集中分流；不改 `tab-store.ts` 的数据结构。
- 已有页签不删除：开启时只是不显示，活动页签照常工作；关闭开关后页签栏和其它页签原样回来。
- 开启瞬间不做任何页签合并或关闭。

### 顶栏外观（预览后定稿）

- 单页签模式下顶栏加高到 48px（与原页面头部同高），Windows 覆盖层高度跟随（IPC 带 `height`，只作用于主窗口）。
- 页面头部（面包屑 / 标题 / 右侧操作）通过 `PageHeaderPortalProvider` 整体 portal 到顶栏，页面里不再有头部行，白色页面从标题下方开始。
- 顶栏头部前面放当前页面的图标（复用页签栏的 `useTabPresentation` / `ResourceLeadingVisual`）；列表类页面自带图标（`data-page-header-icon`）时自动隐藏，避免重复。
- 末级标题加粗、字号 15px。
- 已知：热更新 `desktop-layout.tsx` 会丢失工作区单例，页面显示「正在加载工作区」，重启开发实例即可；打包版不受影响。

## 测试

- 单元测试（vitest，已有同类测试可参照）：
  - `navigation.test.tsx`：单页签模式下 `openInNewTab` / `background-tab` / 钉住页签 push 均落到 `navigateActiveSession`；关闭时行为与现状一致。
  - `desktop-prefs-store.test.ts`：默认值、持久化键、切换。
  - `use-tab-selection-shortcut.test.tsx`：单页签模式下不切换。
- 主进程 `titleBarOverlay` 参数：对 `resolveWindowOptions` 或新抽出的 `titleBarOptionsFor(platform)` 做纯函数测试。
- 手工验收（开发模式窗口）：
  1. Windows 下无原生标题栏；三个窗口按钮在页签栏右上角；拖动、双击最大化、分屏菜单正常。
  2. 切换浅色 / 深色主题，按钮区颜色跟着变。
  3. 打开单页签模式：页签栏消失，Ctrl+点击 issue 链接在当前页打开，钉住页签的跳转不再开新页，Ctrl+W 无效。
  4. 关闭开关：页签栏和之前的页签全部回来。
  5. issue 弹出窗口同样无原生标题栏。

## 发布

- 在 `lilith/main` 上提交，打 `v0.7.1-lilith.3`，`pnpm run package -- --win --x64 --publish never`，
  `gh release create` 上传安装包、blockmap、latest.yml。已装的 lilith.2 通过客户端内更新升级。

## 与上游的冲突面

- `index.ts` 窗口创建处、`navigation.tsx`、`desktop-layout.tsx`、`window-toolbar.tsx`、`routes.tsx` 各一处小改动；
  新文件：`desktop-prefs-store.ts`、设置页组件、测试。上游改这些文件时冲突可控。
