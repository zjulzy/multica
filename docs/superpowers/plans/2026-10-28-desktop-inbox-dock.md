# Desktop Inbox Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional VS Code-style bottom Inbox dock to Multica Desktop that reuses the full Inbox experience without changing the active page route.

**Architecture:** Extract the route-independent Inbox UI into a controlled `InboxSurface`, then keep `InboxPage` as the URL-backed wrapper and mount a second locally controlled surface inside a Desktop-only resizable dock. Desktop preferences own enable/open state, `useDefaultLayout` persists panel height, and shared Query caches keep the page and dock synchronized without sharing selection.

**Tech Stack:** React 19, TypeScript, Zustand persist middleware, TanStack Query, `react-resizable-panels`, Vitest, Testing Library, Electron Desktop renderer.

**Spec:** `docs/superpowers/specs/2026-10-28-desktop-inbox-dock-design.html`

## Global Constraints

- Desktop only: do not change Web, Mobile, server APIs, routes, or database schema.
- Enabling the feature hides only Desktop's sidebar Inbox item; notification/search/deep-link navigation still opens the normal `/:slug/inbox` page.
- Main-page Inbox and dock may coexist. They share Query/mutation data but never selection, route state, layout state, or global shortcut handling.
- First enable starts collapsed. Later launches restore enabled/open state and dock height; selected Inbox item and scroll state do not survive an app restart.
- Workspace switches keep the dock's open state and height but clear its selected item and show the new workspace's Inbox.
- New messages update the current workspace unread badge and never auto-expand the dock.
- First release contains only Inbox. Keep the component seam extensible, but do not build Chat, logs, plugins, or a generic dock registration system.
- Code comments are English. User-visible strings are localized under the existing Desktop sections and follow `apps/docs/content/docs/developers/conventions*.mdx`.
- Do not launch dev mode, replace the installed client, stop user processes, or package during implementation. The manual experience gate in Task 5 is mandatory before packaging.

## Review Focus

1. **Page and dock mounted together:** selecting/archiving in the dock must not rewrite the route or run the page's archive shortcut twice. Task 2 adds controller and shortcut-isolation tests; Task 4 mounts both in a shell test.
2. **Workspace switch while expanded:** open state and stored height remain, but the old workspace selection disappears before the new Inbox renders. Task 3 tests the workspace-id transition.
3. **Collapse with active work:** collapsed content is inert and unfocusable, while reopening preserves in-session selection and the existing comment draft behavior. Task 3 tests mount continuity and inert state.
4. **Short windows and drag bounds:** the content pane remains usable and the dock clamps to 260px minimum / 70% maximum without overflow or double scrollbars. Task 4 pins panel props and the manual gate checks real resize behavior.
5. **Preference combinations and no-workspace shell:** dock enabled/disabled × single-tab enabled/disabled must render correctly, and no Dock may mount before a workspace resolves. Task 4 covers the matrix and workspace gate.

---

### Task 1: Desktop preference and Appearance setting

**Files:**
- Modify: `apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts`
- Modify: `apps/desktop/src/renderer/src/stores/desktop-prefs-store.test.ts`
- Modify: `apps/desktop/src/renderer/src/components/appearance-settings-tab.tsx`
- Create: `apps/desktop/src/renderer/src/components/appearance-settings-tab.test.tsx`
- Modify: `packages/views/locales/en/settings.json`
- Modify: `packages/views/locales/zh-Hans/settings.json`
- Modify: `packages/views/locales/zh-Hant/settings.json`
- Modify: `packages/views/locales/ja/settings.json`
- Modify: `packages/views/locales/ko/settings.json`
- Modify: `packages/views/locales/fr/settings.json`

**Interfaces:**
- Produces: `inboxDockEnabled: boolean`, `inboxDockOpen: boolean`, `setInboxDockEnabled(enabled: boolean): void`, and `setInboxDockOpen(open: boolean): void` on `DesktopPrefsStore`.
- Produces: Appearance setting copy at `settings.desktop.appearance.inbox_dock_title` and `inbox_dock_description`.

- [ ] **Step 1: Add failing store tests**

  Extend `desktop-prefs-store.test.ts` with tests named:

  - `defaults the Inbox dock to disabled and collapsed`
  - `persists the Inbox dock enable and open preferences`
  - `preserves false defaults when rehydrating version 1 preferences`

  Assert exact defaults `inboxDockEnabled === false` and `inboxDockOpen === false`, and persisted JSON keys under `multica_desktop_prefs`.

- [ ] **Step 2: Run the store test and verify RED**

  Run:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\apps\desktop
  corepack pnpm vitest run src/renderer/src/stores/desktop-prefs-store.test.ts
  ```

  Expected: FAIL because the Inbox dock fields and setters do not exist.

- [ ] **Step 3: Implement the persisted preference interface**

  In `desktop-prefs-store.ts`:

  ```ts
  inboxDockEnabled: boolean;
  inboxDockOpen: boolean;
  setInboxDockEnabled: (enabled: boolean) => void;
  setInboxDockOpen: (open: boolean) => void;
  ```

  Bump the persisted store version from `1` to `2`. Add a `migrate` callback that supplies `false` for both fields when absent while preserving `singleTabMode`. `setInboxDockEnabled(false)` must also set `inboxDockOpen: false`; enabling must not auto-open it.

- [ ] **Step 4: Run the store test and verify GREEN**

  Run the Step 2 command.

  Expected: PASS.

- [ ] **Step 5: Add a failing Appearance setting test**

  Create `appearance-settings-tab.test.tsx` and assert:

  - the new Switch is labeled with `desktop.appearance.inbox_dock_title`;
  - its initial checked state follows `inboxDockEnabled`;
  - toggling it calls the store and does not change `singleTabMode`.

- [ ] **Step 6: Run the Appearance test and verify RED**

  Run:

  ```powershell
  corepack pnpm vitest run src/renderer/src/components/appearance-settings-tab.test.tsx
  ```

  Expected: FAIL because the new setting row and locale keys do not exist.

- [ ] **Step 7: Implement the Appearance row and all supported translations**

  Add a second `SettingsRow` to the existing Appearance card. Use the exact English and Simplified Chinese copy approved in the spec:

  - EN title: `Bottom inbox panel`
  - EN description: `Keep a collapsible inbox at the bottom of the window and hide Inbox from the sidebar.`
  - zh-Hans title: `底部收件箱面板`
  - zh-Hans description: `在窗口底部常驻可折叠的收件箱，并隐藏侧栏中的收件箱入口。`

  Translate the same meaning naturally for zh-Hant, ja, ko, and fr. Keep these keys in the Desktop-only `desktop.appearance` object.

- [ ] **Step 8: Run Task 1 tests and commit**

  Run:

  ```powershell
  corepack pnpm vitest run src/renderer/src/stores/desktop-prefs-store.test.ts src/renderer/src/components/appearance-settings-tab.test.tsx
  ```

  Expected: PASS.

  Commit:

  ```powershell
  git add apps/desktop/src/renderer/src/stores/desktop-prefs-store.ts apps/desktop/src/renderer/src/stores/desktop-prefs-store.test.ts apps/desktop/src/renderer/src/components/appearance-settings-tab.tsx apps/desktop/src/renderer/src/components/appearance-settings-tab.test.tsx packages/views/locales/*/settings.json docs/superpowers/specs/2026-10-28-desktop-inbox-dock-design.html docs/superpowers/plans/2026-10-28-desktop-inbox-dock.md
  git commit -m "feat(desktop): add Inbox dock preference"
  ```

---

### Task 2: Extract a controlled reusable Inbox surface

**Files:**
- Create: `packages/views/inbox/components/inbox-surface.tsx`
- Modify: `packages/views/inbox/components/inbox-page.tsx`
- Modify: `packages/views/inbox/components/index.ts`
- Modify: `packages/views/inbox/index.ts`
- Create: `packages/views/inbox/components/inbox-surface.test.tsx`
- Modify: `packages/views/inbox/components/inbox-page.test.tsx`
- Modify: `packages/views/inbox/components/inbox-page-query.test.tsx`

**Interfaces:**
- Produces:

  ```ts
  export interface InboxSurfaceController {
    view: InboxView;
    selectedKey: string;
    setView: (view: InboxView) => void;
    setSelectedKey: (key: string) => void;
    onUnresolvedSelection: (key: string) => void;
  }

  export interface InboxSurfaceProps {
    controller: InboxSurfaceController;
    variant: "page" | "dock";
    layoutId: string;
    headerAction?: React.ReactNode;
    onDockHeaderToggle?: () => void;
    enableGlobalArchiveShortcut?: boolean;
    contentInert?: boolean;
  }

  export function InboxSurface(props: InboxSurfaceProps): React.ReactElement;
  ```

- Preserves: `InboxPage(): React.ReactElement` and all existing URL/deep-link behavior.
- Consumers in Task 3 use `variant="dock"`, `layoutId="multica_inbox_dock_content_layout"`, and `enableGlobalArchiveShortcut={false}`.

- [ ] **Step 1: Add failing controller isolation tests**

  In `inbox-surface.test.tsx`, reuse the existing Inbox test fixtures/mocks and add tests named:

  - `selects through the supplied controller without calling navigation`
  - `reports an unresolved dock selection through the controller`
  - `renders dock chrome locally instead of mounting PageHeader`
  - `does not register the global archive shortcut when disabled`

  The test controller is local state plus spies; assert `replace` is untouched for dock interactions.

- [ ] **Step 2: Run the new surface test and verify RED**

  Run:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\packages\views
  corepack pnpm vitest run inbox/components/inbox-surface.test.tsx
  ```

  Expected: FAIL because `InboxSurface` is not exported.

- [ ] **Step 3: Extract `InboxSurface` without changing behavior**

  Move the query, filter, mutation, list/detail rendering, compact layout, and horizontal resizable layout from `InboxPage` into `inbox-surface.tsx`. Replace direct URL writes with the supplied controller.

  Exact behavior differences by prop:

  - `variant="page"`: use the existing 48px `PageHeader`, existing `layoutId="multica_inbox_layout"`, and global archive shortcut.
  - `variant="dock"`: use a local 36px header containing Inbox title, current-workspace unread count, filters/batch actions, and `headerAction`; never portal into the single-tab top bar.
  - `enableGlobalArchiveShortcut={false}`: do not attach the document-level `archiveInboxItem` listener.
  - `contentInert={true}`: keep the surface and its controller mounted, but apply `inert`, `aria-hidden`, and pointer blocking to the body below the local Dock header. The header and `headerAction` remain interactive.
  - Use the supplied `layoutId` in `useDefaultLayout` so page and dock list/detail widths never overwrite each other.
  - Keep `IssueDetail` functional in both variants; use `layoutId="multica_inbox_dock_issue_detail_layout"` for dock details and the existing id for the page.

- [ ] **Step 4: Reduce `InboxPage` to a route-backed controller**

  Keep URL parsing/building and `useNavigation().replace` in `inbox-page.tsx`. Its controller must:

  - initialize from `?view=` and `?issue=`;
  - sync when external navigation changes those params;
  - clear selection when switching active/archived view;
  - navigate unresolved deep links to `wsPaths.issueDetail(key)` exactly as today.

  Render one `InboxSurface` with `variant="page"` and `enableGlobalArchiveShortcut`.

- [ ] **Step 5: Run surface and existing Inbox suites and verify GREEN**

  Run:

  ```powershell
  corepack pnpm vitest run inbox/components/inbox-surface.test.tsx inbox/components/inbox-page.test.tsx inbox/components/inbox-page-query.test.tsx
  ```

  Expected: PASS with all pre-existing Inbox assertions unchanged.

- [ ] **Step 6: Commit the reusable surface**

  ```powershell
  git add packages/views/inbox
  git commit -m "refactor(inbox): extract reusable Inbox surface"
  ```

---

### Task 3: Build the Desktop Inbox dock and state lifecycle

**Files:**
- Create: `apps/desktop/src/renderer/src/components/inbox-dock.tsx`
- Create: `apps/desktop/src/renderer/src/components/inbox-dock.test.tsx`
- Modify: `packages/views/locales/en/inbox.json`
- Modify: `packages/views/locales/zh-Hans/inbox.json`
- Modify: `packages/views/locales/zh-Hant/inbox.json`
- Modify: `packages/views/locales/ja/inbox.json`
- Modify: `packages/views/locales/ko/inbox.json`
- Modify: `packages/views/locales/fr/inbox.json`

**Interfaces:**
- Consumes: Task 1 store fields and Task 2 `InboxSurface`.
- Produces:

  ```ts
  export function DesktopInboxDockLayout({
    children,
    enabled,
    workspaceId,
  }: {
    children: React.ReactNode;
    enabled: boolean;
    workspaceId: string | null;
  }): React.ReactElement;
  ```

- Uses outer layout id `multica_desktop_inbox_dock_layout` and panel ids `content` / `inbox-dock`.

- [ ] **Step 1: Write failing Dock lifecycle tests**

  Mock `InboxSurface` as a controlled probe and cover:

  - disabled or unresolved `workspaceId` returns `children` without a resizable group;
  - first enable renders the 36px collapsed Dock;
  - clicking the header action toggles `inboxDockOpen`;
  - expanded Dock passes `variant="dock"`, a distinct layout id, and global shortcuts disabled;
  - workspace id change preserves open state but resets `view="inbox"` and `selectedKey=""`;
  - collapsed Dock keeps the surface mounted and marks its content inert/unfocusable.

- [ ] **Step 2: Run the Dock test and verify RED**

  Run:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\apps\desktop
  corepack pnpm vitest run src/renderer/src/components/inbox-dock.test.tsx
  ```

  Expected: FAIL because `DesktopInboxDockLayout` does not exist.

- [ ] **Step 3: Implement the resizable Dock**

  In `inbox-dock.tsx`:

  - Return `children` unchanged when `enabled` is false or `workspaceId` is null.
  - Use `ResizablePanelGroup orientation="vertical"` with `useDefaultLayout({ id: "multica_desktop_inbox_dock_layout" })`.
  - Content panel: id `content`, minimum `30%`.
  - Dock panel: id `inbox-dock`, `collapsible`, `collapsedSize={36}`, `minSize={260}`, `maxSize="70%"`, expanded default `38%`.
  - Synchronize programmatic expand/collapse with `inboxDockOpen`; update the store when drag-to-collapse changes panel state.
  - Keep `InboxSurface` mounted while collapsed. Pass `contentInert={!inboxDockOpen}` so content below the 36px header is inert/aria-hidden/pointer-blocked while the header toggle stays interactive.
  - On the `workspaceId` prop changing, reset only local `view` and `selectedKey`.
  - Supply localized expand/collapse accessible labels under `inbox.dock.expand` and `inbox.dock.collapse` for all supported locales.

- [ ] **Step 4: Run Dock tests and verify GREEN**

  Run the Step 2 command.

  Expected: PASS.

- [ ] **Step 5: Commit the Dock component**

  ```powershell
  git add apps/desktop/src/renderer/src/components/inbox-dock.tsx apps/desktop/src/renderer/src/components/inbox-dock.test.tsx packages/views/locales/*/inbox.json
  git commit -m "feat(desktop): add resizable Inbox dock"
  ```

---

### Task 4: Integrate the Dock into DesktopShell and hide the sidebar entry

**Files:**
- Modify: `packages/views/layout/app-sidebar.tsx`
- Modify: `packages/views/layout/app-sidebar.test.tsx`
- Modify: `apps/desktop/src/renderer/src/components/desktop-layout.tsx`
- Modify: `apps/desktop/src/renderer/src/components/desktop-layout.test.tsx`
- Modify: `apps/desktop/src/renderer/src/components/desktop-layout.workspace-gate.test.tsx`

**Interfaces:**
- Consumes: `DesktopInboxDockLayout` and `inboxDockEnabled`.
- Changes shared component signature to:

  ```ts
  export interface AppSidebarProps {
    topSlot?: React.ReactNode;
    searchSlot?: React.ReactNode;
    headerClassName?: string;
    headerStyle?: React.CSSProperties;
    hideInboxNav?: boolean;
  }
  ```

  `hideInboxNav` defaults to `false`, preserving Web and existing callers.

- [ ] **Step 1: Add failing sidebar visibility tests**

  Extend `app-sidebar.test.tsx`:

  - default props render the Inbox link and unread count exactly as today;
  - `hideInboxNav` removes only the Inbox row while My Issues and Chat remain;
  - hidden Inbox does not remove the shared unread summary query used by workspace dots.

- [ ] **Step 2: Run the sidebar test and verify RED**

  Run:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\packages\views
  corepack pnpm vitest run layout/app-sidebar.test.tsx
  ```

  Expected: FAIL because `hideInboxNav` is not accepted.

- [ ] **Step 3: Implement platform-controlled Inbox visibility**

  Add `hideInboxNav?: boolean` to `AppSidebarProps` and omit only the `personalNav` entry with `key === "inbox"` during render. Do not move Desktop state into `packages/views` and do not disable unread summary fetching.

- [ ] **Step 4: Add failing DesktopShell integration tests**

  In Desktop layout suites, mock `DesktopInboxDockLayout` and assert:

  - resolved workspace + enabled preference wraps `TabContent` in the Dock layout;
  - `AppSidebar` receives `hideInboxNav={true}` only when enabled;
  - disabled preference leaves the old content tree intact;
  - single-tab true/false × dock enabled/disabled all keep `TabContent` mounted once;
  - no workspace renders neither AppSidebar nor Inbox Dock, while `TabContent` remains mounted for route recovery;
  - main Inbox route and Dock can both render without a second route write or duplicate archive shortcut registration.

- [ ] **Step 5: Run the Desktop layout tests and verify RED**

  Run:

  ```powershell
  corepack pnpm vitest run src/renderer/src/components/desktop-layout.test.tsx src/renderer/src/components/desktop-layout.workspace-gate.test.tsx
  ```

  Expected: FAIL because DesktopShell does not mount the Dock or pass the sidebar flag.

- [ ] **Step 6: Integrate the Dock inside MainCanvas**

  Keep `NavigationProgress` anchored to `MainCanvas`. Wrap the existing `PageHeaderPortalProvider` + `TabContent` content region with `DesktopInboxDockLayout`; keep `FloatingChat` outside that vertical group so its existing overlay behavior is unchanged. Mount the Dock only after `slug` resolves.

  Read `inboxDockEnabled` once in `DesktopShell`. Resolve the active workspace object from the already-loaded workspace list, then pass `enabled={inboxDockEnabled}` and `workspaceId={resolvedWorkspace?.id ?? null}` to `DesktopInboxDockLayout`; pass the same enable value to `AppSidebar hideInboxNav`. This keeps Dock mounting and sidebar visibility on one state snapshot.

- [ ] **Step 7: Run Task 4 tests and commit**

  Run:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\packages\views
  corepack pnpm vitest run layout/app-sidebar.test.tsx

  cd E:\code\multica-worktrees\inbox-dock\apps\desktop
  corepack pnpm vitest run src/renderer/src/components/desktop-layout.test.tsx src/renderer/src/components/desktop-layout.workspace-gate.test.tsx
  ```

  Expected: PASS.

  Commit:

  ```powershell
  git add packages/views/layout/app-sidebar.tsx packages/views/layout/app-sidebar.test.tsx apps/desktop/src/renderer/src/components/desktop-layout.tsx apps/desktop/src/renderer/src/components/desktop-layout.test.tsx apps/desktop/src/renderer/src/components/desktop-layout.workspace-gate.test.tsx
  git commit -m "feat(desktop): integrate Inbox dock into the workspace shell"
  ```

---

### Task 5: Verification and mandatory user experience gate

**Files:**
- Verify only; change product files only for defects found by these checks.

**Interfaces:**
- Consumes the completed feature.
- Produces an explicit user acceptance result. Packaging is forbidden until the user says the experience is acceptable.

- [ ] **Step 1: Run focused regression suites**

  Run each package with its own Vitest config:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\apps\desktop
  corepack pnpm vitest run `
    src/renderer/src/stores/desktop-prefs-store.test.ts `
    src/renderer/src/components/appearance-settings-tab.test.tsx `
    src/renderer/src/components/inbox-dock.test.tsx `
    src/renderer/src/components/desktop-layout.test.tsx `
    src/renderer/src/components/desktop-layout.workspace-gate.test.tsx

  cd E:\code\multica-worktrees\inbox-dock\packages\views
  corepack pnpm vitest run `
    inbox/components/inbox-surface.test.tsx `
    inbox/components/inbox-page.test.tsx `
    inbox/components/inbox-page-query.test.tsx `
    layout/app-sidebar.test.tsx
  ```

  Expected: all selected tests PASS.

- [ ] **Step 2: Run static checks**

  Run:

  ```powershell
  corepack pnpm typecheck
  corepack pnpm lint
  git diff --check
  ```

  Expected: all exit 0. Do not use `corepack pnpm test`; `scripts/package.test.mjs` is a known unrelated failure documented in `docs/lilith/DEV-NOTES.md`.

- [ ] **Step 3: Review the final diff before touching the running app**

  Run:

  ```powershell
  git status --short
  git diff --stat HEAD~4..HEAD
  git diff --name-only HEAD~4..HEAD
  git log --oneline -5
  ```

  Confirm only the approved Desktop Inbox Dock scope changed. Do not package.

- [ ] **Step 4: Launch the explicitly requested development window**

  The user has explicitly requested this launch after implementation and automated verification. Use the current migrated server by default:

  ```powershell
  cd E:\code\multica-worktrees\inbox-dock\apps\desktop
  $env:VITE_API_URL='https://multica.lilithgames.com'
  $env:VITE_APP_URL='https://multica.lilithgames.com'
  corepack pnpm dev
  ```

  Keep the visible Multica Canary window open. Tell the user it may use a separate login and ask them to try:

  - enable/disable the setting;
  - open/collapse/resize the Dock on several pages;
  - reply to a message and change a task status;
  - switch workspaces while expanded;
  - open the normal Inbox page while the Dock remains visible;
  - resize the window and test dark/light themes.

- [ ] **Step 5: Stop and wait at the manual gate**

  Do not package and do not close the user's development window. Wait until the user explicitly reports one of:

  - accepted — proceed to cleanup and packaging planning;
  - changes requested — record the exact feel problem, return to the smallest owning task, add a failing regression test, and fix it;
  - stop — leave the implementation committed and record the checkpoint.

- [ ] **Step 6: Restore the official daemon only after the user finishes testing**

  After the user explicitly says the Canary window may be closed, stop only the `electron` / `multica` processes whose executable path is under `E:\code\multica-worktrees\inbox-dock`, then start the installed client daemon with profile `desktop-multica.lilithgames.com`. Report exactly what was stopped and restored.

  Packaging remains a separate, user-confirmed action after this gate.
