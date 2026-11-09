import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Attachment, TimelineEntry } from "@multica/core/types";
import type { UploadResult } from "@multica/core/hooks/use-file-upload";
import { useCommentCollapseStore, useCommentDraftStore } from "@multica/core/issues/stores";
import { renderWithI18n } from "../../test/i18n";

const apiUploadFile = vi.hoisted(() => vi.fn());
const uploadWithToast = vi.hoisted(() => vi.fn());
const useActorNameMock = vi.hoisted(() => vi.fn(() => ({ getActorName: () => "Ada" })));
const editorDefaultValues = vi.hoisted(() => ({
  values: [] as Array<string | undefined>,
}));

// The real handle mints an id when it inserts the placeholder and hands it to
// the uploader, which adopts it as the draft `clientUploadId`. Mocks must do
// the same or the two records drift apart only in tests.
let mockUploadIdSeq = 0;

vi.mock("@multica/core/api", () => ({
  // Uploads flow through the coordinator, which calls api.uploadFile (MUL-5181).
  api: { uploadFile: apiUploadFile },
  dispatchReasonCode: () => undefined,
  errorCode: (error: unknown) =>
    typeof error === "object" && error !== null && "body" in error
      ? (error as { body?: { code?: string } }).body?.code
      : undefined,
}));

vi.mock("../../navigation", () => ({
  useNavigation: () => ({
    push: vi.fn(),
    pathname: "/acme/issues",
    getShareableUrl: (p: string) => `https://app.example${p}`,
  }),
}));

vi.mock("@multica/core/workspace/hooks", () => ({
  useActorName: useActorNameMock,
}));

vi.mock("../../common/actor-avatar", () => ({
  ActorAvatar: () => null,
}));

// The trigger-preview chips have their own suite; inert here so this file
// stays about the edit gate.
vi.mock("../hooks/use-comment-trigger-preview", () => ({
  useCommentTriggerPreview: () => ({ agents: [], blocked: [] }),
}));

vi.mock("../../editor", async () => ({
  // Real submit gate (pure React) driven by the mock editor below.
  ...(await vi.importActual<typeof import("../../editor/use-upload-gate")>(
    "../../editor/use-upload-gate",
  )),
  // The card nests a ReplyInput, which is readonly-first — real controller.
  ...(await vi.importActual<typeof import("../../editor/use-lazy-editor")>(
    "../../editor/use-lazy-editor",
  )),
  // Real await-then-render submit contract (pure React) — the edit save path
  // now delegates to it.
  ...(await vi.importActual<typeof import("../../editor/use-composer-submit")>(
    "../../editor/use-composer-submit",
  )),
  useEditorUpload: () => ({ uploadWithToast, upload: vi.fn(), uploading: false }),
  useFileDropZone: () => ({ isDragOver: false, dropZoneProps: {} }),
  FileDropOverlay: () => null,
  ReadonlyContent: ({ content }: { content: string }) => <div>{content}</div>,
  Attachment: () => null,
  AttachmentDownloadProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContentEditor: forwardRef(function MockContentEditor(
    {
      defaultValue,
      onUpdate,
      onUploadFile,
      onUploadingChange,
      onSubmit,
      placeholder,
    }: {
      defaultValue?: string;
      onUpdate?: (markdown: string) => void;
      onUploadFile?: (file: File, uploadId: string) => Promise<UploadResult | null>;
      onUploadingChange?: (uploading: boolean) => void;
      onSubmit?: () => void;
      placeholder?: string;
    },
    ref: Ref<unknown>,
  ) {
    editorDefaultValues.values.push(defaultValue);
    const valueRef = useRef(defaultValue ?? "");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Mirrors the real editor's `uploading` node attrs — see the sibling
    // composer suite for the same stand-in.
    const inFlightRef = useRef(0);
    // Mirrors the real editor publishing its current answer on subscribe: a
    // fresh instance owns no pending upload, so it reports "not uploading".
    useEffect(() => {
      onUploadingChange?.(inFlightRef.current > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useImperativeHandle(ref, () => ({
      getMarkdown: () => valueRef.current,
      clearContent: () => { valueRef.current = ""; },
      focus: () => {},
      blur: () => {},
      uploadFile: async (file: File) => {
        inFlightRef.current += 1;
        if (inFlightRef.current === 1) onUploadingChange?.(true);
        try {
          const result = await onUploadFile?.(file, `mock-upload-${++mockUploadIdSeq}`);
          if (!result) return;
          valueRef.current = `${valueRef.current}\n${result.url}`.trim();
          onUpdate?.(valueRef.current);
        } finally {
          inFlightRef.current -= 1;
          if (inFlightRef.current === 0) onUploadingChange?.(false);
        }
      },
      hasActiveUploads: () => inFlightRef.current > 0,
      // Placeholder rebuild contract: the real handle draws a card for an
      // upload the document is not showing and reports whether it landed.
      // Mocks track ids only — no document to draw into.
      insertUploadPlaceholder: () => true,
      settleUploadPlaceholder: () => false,
      // The real handle applies content the `defaultValue` prop cannot land
      // (mount-only) and does so without emitting an update.
      adoptContent: (markdown: string) => {
        valueRef.current = markdown;
        if (textareaRef.current) textareaRef.current.value = markdown;
      },
    }));
    return (
      <textarea
        ref={textareaRef}
        data-testid="editor"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(e) => {
          valueRef.current = e.target.value;
          onUpdate?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit?.();
        }}
      />
    );
  }),
}));

import { CommentCard, ThreadComposerItem, ThreadReplyItem } from "./comment-card";

const entry: TimelineEntry = {
  id: "comment-1",
  issue_id: "issue-1",
  parent_id: null,
  // `actor_*` is what the own-comment / can-edit rule reads.
  actor_type: "member",
  actor_id: "user-1",
  content: "Original body",
  type: "comment",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  revision: 7,
  attachments: [],
  reactions: [],
} as unknown as TimelineEntry;

function renderCard(onEdit = vi.fn().mockResolvedValue(undefined), overrides: Partial<ComponentProps<typeof CommentCard>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderWithI18n(
    <QueryClientProvider client={qc}>
      <CommentCard
        issueId="issue-1"
        entry={entry}
        replies={[]}
        currentUserId="user-1"
        onReply={vi.fn().mockResolvedValue(true)}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onToggleReaction={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  );
  return { ...view, onEdit };
}

/** Open the row's ⋯ menu and click Edit. The trigger is icon-only with no
 *  accessible name, so it is addressed by its menu popup role. */
async function startEditing() {
  const trigger = document.querySelector('button[aria-haspopup="menu"]');
  if (!trigger) throw new Error("Expected the comment actions menu trigger");
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByText("Edit"));
  await screen.findByTestId("editor");
}

function getSaveButton() {
  return screen.getByRole("button", { name: /Save|Uploading…/ });
}

it("animates the reply body while keeping its header visible during collapse", async () => {
  document.documentElement.dataset.interfaceMotion = "on";
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  const animate = vi.fn(() => ({ finished, cancel: vi.fn() }) as unknown as Animation);
  const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  try {
    const reply = { ...entry, id: "motion-reply", parent_id: entry.id, content: "Motion reply" };
    const { container } = renderCard(undefined, { replies: [reply] });
    const row = container.querySelector<HTMLElement>('[data-reply-motion-id="motion-reply"]')!;
    const body = row.querySelector<HTMLElement>("[data-reply-motion-body]")!;
    fireEvent.click(within(row).getByRole("button", { name: /Collapse reply/ }));
    expect(animate.mock.instances[0]).toBe(body);
    expect(row).toBeInTheDocument();
    await act(async () => { finish(); await finished; });
    expect(container.querySelector('[data-reply-fold-id="motion-reply"]')).toBeInTheDocument();
  } finally {
    delete document.documentElement.dataset.interfaceMotion;
    vi.unstubAllGlobals();
    if (previous) Object.defineProperty(HTMLElement.prototype, "animate", previous);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});

it("renders and folds an independent timeline reply without its root mounted", () => {
  const reply = { ...entry, id: "standalone-reply", parent_id: entry.id, content: "Independent reply" };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWithI18n(<QueryClientProvider client={qc}><ThreadReplyItem
    issueId="issue-1" root={entry} row={reply} latestReplyId="other-reply" replies={[reply]}
    currentUserId="user-1" onEdit={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn()} onToggleReaction={vi.fn()}
  /></QueryClientProvider>);
  const button = screen.getByRole("button", { name: /Expand reply:.*Independent reply/ });
  expect(screen.queryByText("Independent reply")).toBeNull();
  fireEvent.click(button);
  expect(screen.getByText("Independent reply")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Collapse reply:.*Independent reply/ })).toBe(button);
});

it("does not rerender an unchanged folded reply when its parent updates", () => {
  const reply = { ...entry, id: "memoized-reply", parent_id: entry.id, content: "Stable reply" };
  const replies = [reply];
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onEdit = vi.fn().mockResolvedValue(undefined), onDelete = vi.fn(), onToggleReaction = vi.fn();
  const view = () => <QueryClientProvider client={qc}><ThreadReplyItem
    issueId="issue-1" root={entry} row={reply} latestReplyId="other" replies={replies} currentUserId="user-1"
    onEdit={onEdit} onDelete={onDelete} onToggleReaction={onToggleReaction} />
  </QueryClientProvider>;
  const rendered = renderWithI18n(view());
  const before = useActorNameMock.mock.calls.length;
  rendered.rerender(view());
  expect(useActorNameMock.mock.calls.length).toBe(before);
});

it("keeps an independent reply's edit draft and editing state across unmount", async () => {
  const reply = { ...entry, id: "virtual-edit-reply", parent_id: entry.id, content: "Original reply" };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = () => <QueryClientProvider client={qc}><ThreadReplyItem
    issueId="issue-1" root={entry} row={reply} latestReplyId={reply.id} replies={[reply]}
    currentUserId="user-1" onEdit={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn()} onToggleReaction={vi.fn()}
  /></QueryClientProvider>;
  const first = renderWithI18n(view());
  await startEditing();
  fireEvent.change(screen.getByTestId("editor"), { target: { value: "Unfinished virtual edit" } });
  first.unmount();
  renderWithI18n(view());
  expect(screen.getByTestId("editor")).toHaveValue("Unfinished virtual edit");
});

it("captures a reply annotation from an independent timeline row", async () => {
  const reply = { ...entry, id: "virtual-annotation-reply", parent_id: entry.id, content: "Selected virtual reply" };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 600, 400));
  Range.prototype.getBoundingClientRect = vi.fn(() => new DOMRect(10, 10, 120, 20));
  Range.prototype.getClientRects = vi.fn(() => [] as unknown as DOMRectList);
  const { container } = renderWithI18n(<QueryClientProvider client={qc}><div data-issue-scroll-container><ThreadReplyItem
    issueId="issue-1" root={entry} row={reply} latestReplyId={reply.id} replies={[reply]}
    currentUserId="user-1" onEdit={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn()} onToggleReaction={vi.fn()}
  /><ThreadComposerItem issueId="issue-1" root={entry} replies={[reply]} currentUserId="user-1" onReply={vi.fn().mockResolvedValue(true)} /></div></QueryClientProvider>);
  const source = container.querySelector<HTMLElement>(`[data-comment-content="${reply.id}"]`)!;
  fireEvent.pointerDown(source, { pointerType: "mouse", button: 0 });
  fireEvent.mouseDown(source, { button: 0 });
  const range = document.createRange();
  range.selectNodeContents(source);
  act(() => { window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range); });
  fireEvent.pointerUp(source);
  fireEvent.mouseUp(source, { button: 0 });
  fireEvent.click(source, { button: 0 });
  fireEvent.click(await screen.findByRole("button", { name: "Add to reply" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "Comment" }), { target: { value: "Virtual note" } });
  fireEvent.click(await screen.findByRole("button", { name: "Add annotation" }));
  expect(useCommentDraftStore.getState().getAnnotations("reply:issue-1:comment-1")).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceCommentId: reply.id, quote: "Selected virtual reply", note: "Virtual note" }),
  ]));
  expect(await screen.findAllByRole("button", { name: "Edit annotation 1" })).toHaveLength(1);
  vi.restoreAllMocks();
});

it("opens an annotation after its offscreen source reply is mounted", async () => {
  const reply = { ...entry, id: "virtual-annotation-source", parent_id: entry.id, content: "Saved virtual quote" };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = "reply:issue-1:comment-1" as const;
  useCommentDraftStore.getState().addAnnotation(key, { id: "saved-virtual-note", sourceCommentId: reply.id, sourceActorName: "Ada",
    quote: "Saved virtual quote", start: 0, prefix: "", suffix: "", note: "Existing note" });
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 600, 400));
  Range.prototype.getBoundingClientRect = vi.fn(() => new DOMRect(10, 10, 120, 20));
  Range.prototype.getClientRects = vi.fn(() => [] as unknown as DOMRectList);
  function Fixture() {
    const [show, setShow] = useState(false);
    return <div data-issue-scroll-container>{show && <ThreadReplyItem issueId="issue-1" root={entry} row={reply} latestReplyId="other" requestedReplyId={reply.id}
      replies={[reply]} currentUserId="user-1" onEdit={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn()} onToggleReaction={vi.fn()} />}
      <ThreadComposerItem issueId="issue-1" root={entry} replies={[reply]} currentUserId="user-1" onReply={vi.fn().mockResolvedValue(true)} onJumpToComment={() => setShow(true)} />
    </div>;
  }
  renderWithI18n(<QueryClientProvider client={qc}><Fixture /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: /1 annotation/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Edit annotation 1" }));
  expect(await screen.findByRole("textbox", { name: "Comment" })).toHaveValue("Existing note");
  vi.restoreAllMocks();
});

it("keeps the same reply header across fold changes without showing a preview", () => {
  const old = { ...entry, id: "unified-header-old", parent_id: entry.id, content: "Older hidden body", created_at: "2026-07-01T00:01:00Z" };
  const newest = { ...entry, id: "unified-header-new", parent_id: entry.id, content: "Latest body", created_at: "2026-07-01T00:02:00Z" };
  renderCard(undefined, { replies: [old, newest] });
  const button = screen.getByRole("button", { name: /Expand reply:.*Older hidden body/ });
  expect(screen.queryByText("Older hidden body")).toBeNull();
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: /Collapse reply:.*Older hidden body/ })).toBe(button);
  expect(screen.getByText("Older hidden body")).toBeInTheDocument();
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: /Expand reply:.*Older hidden body/ })).toBe(button);
  expect(screen.queryByText("Older hidden body")).toBeNull();
});

beforeEach(() => {
  uploadWithToast.mockReset();
  apiUploadFile.mockReset();
  useCommentDraftStore.setState({ drafts: {} });
  useCommentCollapseStore.setState({ collapsedByIssue: {} });
  editorDefaultValues.values = [];
});

describe("comment edit — draft snapshot", () => {
  it("keeps an edited reply mounted if a newer reply arrives", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const old = { ...entry, id: "editing-latest", parent_id: entry.id, content: "Editable reply", created_at: "2026-07-01T00:01:00Z" };
    const newer = { ...old, id: "newer-reply", content: "Newer reply", created_at: "2026-07-01T00:02:00Z" };
    const view = (replies: TimelineEntry[]) => <QueryClientProvider client={qc}><CommentCard
      issueId="issue-1" entry={entry} replies={replies} currentUserId="user-1"
      onReply={vi.fn().mockResolvedValue(true)} onEdit={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn()} onToggleReaction={vi.fn()}
    /></QueryClientProvider>;
    const rendered = renderWithI18n(view([old]));
    const row = document.getElementById("comment-editing-latest")!;
    fireEvent.click(within(row).getByRole("button", { name: "Comment actions" }));
    fireEvent.click(await screen.findByText("Edit"));
    const editor = await within(row).findByTestId("editor");
    fireEvent.change(editor, { target: { value: "unfinished edit" } });
    rendered.rerender(view([old, newer]));
    expect(within(row).getByTestId("editor")).toHaveValue("unfinished edit");
    expect(screen.getByText("Newer reply")).toBeInTheDocument();
    const flush = vi.fn((event: Event) => {
      expect((event as CustomEvent<HTMLElement>).detail).toContainElement(row);
    });
    window.addEventListener("multica:flush-scoped-editors", flush);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Collapse thread" }));
      expect(flush).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("multica:flush-scoped-editors", flush);
    }
  });
  it("does not feed the persisted edit draft back as a new editor default", async () => {
    renderCard();
    await startEditing();

    fireEvent.change(screen.getByTestId("editor"), {
      target: { value: "test.de" },
    });

    expect(
      useCommentDraftStore
        .getState()
        .getDraft("edit:issue-1:comment-1"),
    ).toBe("test.de");
    expect(editorDefaultValues.values.at(-1)).toBe("Original body");
  });
});

describe("comment edit — content conflict", () => {
  it("keeps the local draft visible and resubmits with the captured content", async () => {
    const onEdit = vi.fn().mockRejectedValue({
      body: { code: "revision_conflict" },
    });
    renderCard(onEdit);
    await startEditing();

    fireEvent.change(screen.getByTestId("editor"), {
      target: { value: "My local edit" },
    });
    fireEvent.click(getSaveButton());

    await waitFor(() =>
      expect(onEdit).toHaveBeenCalledWith(
        "comment-1",
        "My local edit",
        [],
        undefined,
        "Original body",
      ),
    );
    expect(await screen.findByText("The comment was changed concurrently. Compare both versions.")).toBeVisible();
    expect(screen.getByText("My local edit")).toBeVisible();
    expect(screen.getByTestId("editor")).toBeVisible();
    expect(
      useCommentDraftStore.getState().getDraft("edit:issue-1:comment-1"),
    ).toBe("My local edit");
  });

  it("loads the server version into the editor when the user takes theirs", async () => {
    const onEdit = vi.fn().mockRejectedValue({
      body: { code: "revision_conflict" },
    });
    renderCard(onEdit);
    await startEditing();

    fireEvent.change(screen.getByTestId("editor"), {
      target: { value: "My local edit" },
    });
    fireEvent.click(getSaveButton());
    expect(
      await screen.findByText("The comment was changed concurrently. Compare both versions."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Use the latest version" }));

    await waitFor(() =>
      expect(
        screen.queryByText("The comment was changed concurrently. Compare both versions."),
      ).not.toBeInTheDocument(),
    );
    // The draft is replaced by the server body, and the editor shows it — a
    // dirty editor ignores prop-driven content, so this proves adoptContent ran.
    expect((screen.getByTestId("editor") as HTMLTextAreaElement).value).toBe("Original body");
    expect(
      useCommentDraftStore.getState().getDraft("edit:issue-1:comment-1"),
    ).toBe("Original body");
    // Taking the server version is local-only: the server already holds it.
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

// MUL-4808 — comment edit had no upload gate: saving mid-upload persisted the
// edit with the pending image stripped out of the body and its id unbound.
describe("comment edit — upload submit gate", () => {
  function startPendingUpload(container: HTMLElement) {
    let resolveUpload!: (att: Attachment) => void;
    apiUploadFile.mockImplementationOnce(
      () => new Promise<Attachment>((resolve) => { resolveUpload = resolve; }),
    );
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Expected a file input to render");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "shot.png", { type: "image/png" })] },
    });
    return { resolve: (att: Attachment) => resolveUpload(att) };
  }

  it("disables Save while an upload is in flight and re-enables once it settles", async () => {
    const { container } = renderCard();
    await startEditing();
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "Edited body" } });

    const pending = startPendingUpload(container);

    await waitFor(() => expect(getSaveButton()).toBeDisabled());
    expect(getSaveButton()).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      pending.resolve({
        id: "att-1",
        url: "https://cdn.example/att-1.png",
        download_url: "https://cdn.example/att-1.png",
        markdown_url: "https://cdn.example/att-1.png",
        filename: "shot.png",
        content_type: "image/png",
        size_bytes: 1,
      } as unknown as Attachment);
    });

    await waitFor(() => expect(getSaveButton()).not.toBeDisabled());
  });

  // The editor unmounts on Cancel, taking the pending upload's node with it,
  // while the gate state lives on the surviving card. Re-entering edit must
  // come back usable — not stuck on the dead editor's last answer.
  it("does not stay gated after cancelling edit mid-upload and re-entering", async () => {
    const { container } = renderCard();
    await startEditing();
    fireEvent.change(screen.getByTestId("editor"), { target: { value: "Edited body" } });

    startPendingUpload(container);
    await waitFor(() => expect(getSaveButton()).toBeDisabled());

    // Cancel stays available during an upload, so this is reachable.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByTestId("editor")).toBeNull());

    await startEditing();
    await waitFor(() => expect(getSaveButton()).not.toBeDisabled());
    expect(getSaveButton()).not.toHaveAttribute("aria-busy");
  });

  it("blocks the Cmd+Enter save path while an upload is in flight", async () => {
    const { container, onEdit } = renderCard();
    await startEditing();
    const editor = screen.getByTestId("editor");
    fireEvent.change(editor, { target: { value: "Edited body" } });

    startPendingUpload(container);

    // Cmd+Enter reaches saveEdit without ever consulting the Save button.
    fireEvent.keyDown(editor, { key: "Enter", metaKey: true });
    await Promise.resolve();
    expect(onEdit).not.toHaveBeenCalled();
  });
});

// Keep the real card, annotation hook, reply composer and submit wiring together.
// Source parsing and persistence boundary matrices live in their own suites.
describe("comment thread — selection reply", () => {
  it.each([[false, "agent", "agent-1", "comment"], [true, "agent", "agent-1", "comment"], [false, "member", "user-1", "comment"], [false, "member", "other-user", "comment"], [false, "member", "user-1", "note"]] as const)("sends quotes in the source thread and clears overlays (open: %s, author: %s %s, type: %s)", async (keepNoteOpen, actorType, actorId, commentType) => {
    Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: 1024 });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 600, 400));
    Range.prototype.getBoundingClientRect = vi.fn(() => new DOMRect(20, 30, 120, 20));
    Range.prototype.getClientRects = vi.fn(() => [] as unknown as DOMRectList);
    const store = useCommentDraftStore.getState();
    store.setDraft("new:issue-1", "Task-level draft");
    store.setDraft("reply:issue-1:other-thread", "Other thread draft");
    const taskDraft = useCommentDraftStore.getState().drafts["new:issue-1"];
    const onReply = vi.fn().mockResolvedValue("published-reply");
    const child: TimelineEntry = { ...entry, id: "agent-child", parent_id: entry.id, actor_type: actorType, actor_id: actorId, comment_type: commentType, content: "Selected agent text" };
    const { container } = renderCard(undefined, { replies: [child], onReply });
    const source = container.querySelector<HTMLElement>('[data-comment-content="agent-child"]')!;
    expect(source).toHaveAttribute("role", "group");
    expect(source.getAttribute("aria-label")).toMatch(/^Comment by .+/);
    expect(source).toHaveAttribute("tabindex", "0");
    fireEvent.pointerDown(source);
    fireEvent.mouseDown(source);
    const range = document.createRange();
    range.selectNodeContents(source);
    act(() => { window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range); });
    fireEvent.pointerUp(source);
    fireEvent.mouseUp(source);
    fireEvent.click(source);
    fireEvent.click(await screen.findByRole("button", { name: "Add to reply" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Comment" }), { target: { value: "Reply-specific note" } });
    expect(useCommentDraftStore.getState().getAnnotations("reply:issue-1:comment-1")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Add annotation" }));
    if (keepNoteOpen) {
      fireEvent.click(await screen.findByRole("button", { name: "Edit annotation 1" }));
      fireEvent.change(await screen.findByRole("textbox", { name: "Comment" }), { target: { value: "Unconfirmed edit" } });
    }
    expect(container.querySelector('[data-annotation-thread="reply:issue-1:comment-1"]')).toHaveTextContent("1 annotation");
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preview reply" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onReply).toHaveBeenCalledTimes(1));
    expect(onReply).toHaveBeenCalledWith("agent-child", "> Selected agent text\n\nReply-specific note", undefined, undefined, undefined);
    await waitFor(() => {
      expect(useCommentDraftStore.getState().getAnnotations("reply:issue-1:comment-1")).toHaveLength(0);
      expect(document.querySelector("[data-reply-annotation-overlay]")).not.toBeInTheDocument();
    });
    expect(useCommentDraftStore.getState().drafts["new:issue-1"]).toBe(taskDraft);
    expect(useCommentDraftStore.getState().getDraft("reply:issue-1:other-thread")).toBe("Other thread draft");
  });
});
