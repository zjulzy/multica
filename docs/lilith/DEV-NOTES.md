# Lilith fork · 开发交接笔记

给接手这个 fork 的任何助手（Claude、Codex、Multica 智能体）或人看。
上游是 `multica-ai/multica`，我们的分支是 `lilith/main`，远端 `origin` = `zjulzy/multica`，`upstream` = 官方仓库。
许可：Apache 2.0 + Multica 附加条款。内部使用、改源码、自己打包都允许；**不能改 LOGO、产品名、界面署名**。

## 已做的事

| 版本 | 内容 |
|---|---|
| v0.7.1-lilith.1 | 更新源指向 `zjulzy/multica` 的 Release；默认 API 指向内网 `zengine-multica.lilithgames.com` |
| v0.7.1-lilith.2 | `LILITH.md` 发版说明（用于验证一键升级） |
| v0.7.1-lilith.3 | Windows 去掉原生标题栏（覆盖层窗口按钮）；设置 → 界面 → 单页签模式 |
| v0.7.1-lilith.4 | 深色主题下覆盖层按钮区颜色修复 |

设计与计划文档：`docs/superpowers/specs/2026-10-28-win-titlebar-single-tab-design.md`、
`docs/superpowers/plans/2026-10-28-win-titlebar-single-tab.md`。每个任务都有测试和代码片段，按同样格式继续写新功能。

## 版本号规则

官方版本号 + `-lilith.N`，例如 `v0.7.1-lilith.5`。合并官方 `v0.7.2` 后变成 `v0.7.2-lilith.1`。
semver 里 `0.7.1-lilith.x < 0.7.1`，所以官方版到魔改版只能手动装一次，之后 lilith 之间、跨官方号都能客户端内升级。
不要用 `+lilith` 写法（build metadata 比较时被忽略）。版本由 `git describe --tags --match 'v[0-9]*'` 推导，打 tag 就行。

## 环境

- Windows，Git Bash 或 PowerShell 5.1 均可。新开 shell 要手动加 PATH：`C:\Program Files\Go\bin`、`C:\Program Files\GitHub CLI`。
- Node 24、pnpm 10.28（用 `corepack pnpm`）、Go 1.27（打包内嵌 CLI 必需）、gh（已以 zjulzy 登录）。
- 仓库文件多为 CRLF，`core.autocrlf=false`。用脚本改文件时按原换行写回。
- 首次 `pnpm install` 不会下载 Electron 开发二进制，开发模式前跑一次 `node node_modules/electron/install.js`。

## 常用命令（在 `apps/desktop` 下）

```bash
corepack pnpm vitest run <file>      # 单测
corepack pnpm test                   # 全量（scripts/package.test.mjs 本来就挂，语法错误，忽略）
corepack pnpm typecheck
VITE_API_URL=http://zengine-multica.lilithgames.com VITE_APP_URL=http://zengine-multica.lilithgames.com corepack pnpm dev > dev.log 2>&1
corepack pnpm run package -- --win --x64 --publish never
```

发版：`git tag v0.7.1-lilith.N && git push origin lilith/main v0.7.1-lilith.N`，打包后
`gh release create v0.7.1-lilith.N --repo zjulzy/multica --prerelease --latest=false dist/*.exe dist/*.blockmap dist/latest.yml`。
已装的客户端在 设置 → Updates 里一键升级。每个版本的产物另存一份到 `E:\backup\lilith-releases\`。

## 开发模式的坑（实测）

1. 开发模式不读 `~/.multica/desktop.json`，必须带上面两个 `VITE_*` 环境变量，否则连 localhost:8080。
2. 开发实例叫「Multica Canary」，userData 和正式版分开，要重新登录一次；登录态之后保留。
3. 开发实例发现守护进程版本和它内嵌的 CLI 不一致，会用 `apps/desktop/resources/bin/multica.exe` **重启守护进程**。关掉开发实例后这个守护进程变孤儿、锁住该 exe，再次 `pnpm dev` 或打包时报 `EPERM unlink`。处理：
   `Get-Process electron,multica | ? Path -like 'E:\code\*' | Stop-Process -Force`，然后用正式版 CLI
   `"%LOCALAPPDATA%\Programs\@multicadesktop\resources\app.asar.unpacked\resources\bin\multica.exe" --profile desktop-zengine-multica.lilithgames.com daemon start` 交还。
4. 渲染层控制台会打进 electron-vite 的 stdout，把 `pnpm dev` 的输出直接重定向到文件就能看；别接 `grep | tail` 管道，会被缓冲到进程退出。
5. 热更新 `src/renderer/src/components/desktop-layout.tsx` 会丢工作区单例，界面停在「正在加载工作区」，重启开发实例即可，打包版不受影响。
6. 主进程文件改动会让开发实例自动重启一次。
7. 打包前 electron-builder 要解压 `winCodeSign`，其中两个 macOS 符号链接在 Windows 上解压失败会让整个打包中止。已手动解压到 `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0`，清缓存后要重做。

## 代码地图（本 fork 动过的地方）

- `apps/desktop/src/main/title-bar.ts`：按平台生成标题栏选项（Windows `hidden` + `titleBarOverlay`）。
- `apps/desktop/src/main/index.ts`：IPC `window:set-title-bar-overlay`（颜色 + 主窗口高度）。
- `apps/desktop/src/renderer/src/platform/title-bar-overlay-sync.tsx`：读 CSS 变量、光栅化成 hex、随主题 / 单页签模式同步。
- `apps/desktop/src/renderer/src/platform/desktop-os.ts`：`isWindowsDesktop()`、右侧按钮留白。
- `apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts`：`singleTabMode`。
- `apps/desktop/src/renderer/src/platform/navigation.tsx`：单页签模式下的导航分流。
- `apps/desktop/src/renderer/src/components/desktop-layout.tsx`：顶栏高度、页面头部插槽、页面图标。
- `packages/views/layout/page-header.tsx`：`PageHeaderPortalProvider`（头部 portal 到顶栏）。
- `packages/views/locales/*/settings.json`：`desktop.appearance.*`、`desktop.tabs.appearance`。

## 同步上游

```bash
git fetch upstream --tags
git merge v0.7.X          # 官方下一个 release tag
```

冲突面集中在上面「代码地图」里的文件，改动都尽量贴边、用新文件承载。
