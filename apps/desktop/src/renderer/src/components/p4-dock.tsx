import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { issueTasksOptions } from "@multica/core/issues/queries";
import { agentListOptions, memberListOptions } from "@multica/core/workspace/queries";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { parsePinnedIssueRoute } from "./pinned-issue-route";
import { issueIdentifiers } from "../../../shared/p4-issue-match";
import { P4DiffView } from "./p4-diff-view";
import { chooseP4AskAgent, formatP4AskMention } from "./p4-ask-agent";
import { AlertCircle, FileCode2, FolderGit2, GitCompareArrows, Loader2, RefreshCw, Sparkles, Undo2 } from "lucide-react";
import "./p4-dock.css";

type Row = Record<string, string>;
const actionLabels: Record<string, string> = { edit: "修改", add: "新增", delete: "删除", "move/add": "移入", "move/delete": "移出", integrate: "集成", branch: "分支" };
export function P4Dock({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const route = useRenderedRouteStore((s) => s.pathname);
  const issueRoute = parsePinnedIssueRoute(route);
  const { issue, canonicalId } = useCanonicalIssue(workspaceId, issueRoute?.issue ?? "");
  const ids = useMemo(() => issue ? issueIdentifiers(issue.identifier ?? "", issue.title, issue.description ?? "") : [], [issue?.identifier, issue?.title, issue?.description]);
  const [refresh, setRefresh] = useState(0);
  const [changes, setChanges] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [files, setFiles] = useState<Row[]>([]);
  const [file, setFile] = useState<Row | null>(null);
  const [diff, setDiff] = useState("");
  const [selection, setSelection] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSelected(null); setFiles([]); setFile(null); setDiff(""); setSelection(""); setError(""); setChanges([]);
    if (!issueRoute || !ids.length) { setLoading(false); return; }
    setLoading(true);
    void window.desktopAPI.p4IssueChanges(ids).then((value) => { if (!cancelled) setChanges(value); }).catch((e) => { if (!cancelled) setError(String(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canonicalId, ids, refresh]);
  useEffect(() => {
    let cancelled = false;
    setFiles([]); setFile(null); setDiff(""); setSelection("");
    if (!selected) { setLoadingFiles(false); return; }
    setLoadingFiles(true);
    void window.desktopAPI.p4ChangeFiles(ids, selected.client, selected.change).then((value) => { if (!cancelled) setFiles(value); }).catch((e) => { if (!cancelled) setError(String(e)); }).finally(() => { if (!cancelled) setLoadingFiles(false); });
    return () => { cancelled = true; };
  }, [selected, ids]);
  useEffect(() => {
    let cancelled = false;
    setDiff(""); setSelection("");
    if (!selected || !file) { setLoadingDiff(false); return; }
    setLoadingDiff(true);
    void window.desktopAPI.p4FileDiff(ids, selected.client, selected.change, file.depotFile).then((value) => { if (!cancelled) setDiff(value); }).catch((e) => { if (!cancelled) setError(String(e)); }).finally(() => { if (!cancelled) setLoadingDiff(false); });
    return () => { cancelled = true; };
  }, [selected, file, ids]);
  const ask = async () => {
    if (!issue || !issueRoute || !canonicalId || !selected || !file || !selection || selection.length > 45000 || asking) return;
    const sourceRoute = issueRoute;
    const sourceIssue = issue;
    const ticks = "`".repeat(Math.max(3, ...Array.from(selection.matchAll(/`+/g), (m) => m[0].length + 1)));
    setAsking(true);
    try {
      const [agentsResult, tasksResult, membersResult] = await Promise.allSettled([
        queryClient.fetchQuery({ ...agentListOptions(workspaceId), retry: false }),
        queryClient.fetchQuery({ ...issueTasksOptions(canonicalId, false, "history"), retry: false }),
        queryClient.fetchQuery({ ...memberListOptions(workspaceId), retry: false }),
      ]);
      const currentRoute = parsePinnedIssueRoute(useRenderedRouteStore.getState().pathname);
      if (!mounted.current || currentRoute?.slug !== sourceRoute.slug || currentRoute.issue !== sourceRoute.issue) return;
      const agents = agentsResult.status === "fulfilled" ? agentsResult.value : [];
      const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
      const members = membersResult.status === "fulfilled" ? membersResult.value : [];
      const role = members.find((member) => member.user_id === userId)?.role ?? null;
      const agent = chooseP4AskAgent(sourceIssue, tasks, agents, userId, role);
      const mention = agent ? `${formatP4AskMention(agent)} ` : "";
      const text = `${mention}请帮我看看以下代码：\n\nCL ${selected.change} · ${file.depotFile}\n\n${ticks}diff\n${selection}\n${ticks}\n\n我的问题：`;
      window.dispatchEvent(new CustomEvent("multica:append-issue-comment", { detail: { issueId: canonicalId, text } }));
    } finally {
      if (mounted.current) setAsking(false);
    }
  };
  const buttonStyle = "rounded-md focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40";
  return <div className="p4-dock flex min-h-0 min-w-0 flex-1 flex-col text-sm">
    <div className="p4-dock-toolbar flex min-h-11 items-center gap-3 border-b px-4">
      <span className="p4-dock-icon grid size-7 place-items-center rounded-md"><GitCompareArrows aria-hidden className="size-4" /></span>
      <strong className="shrink-0">P4</strong><span className="h-4 w-px bg-border" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={issue?.title}>{issue?.identifier ?? "请先打开任务"}{issue?.title ? ` · ${issue.title}` : ""}</span>
      <button type="button" aria-label="刷新" title="刷新" className={`${buttonStyle} p4-dock-action flex items-center gap-1.5 px-2.5 py-1.5`} onClick={() => setRefresh((n) => n + 1)}><RefreshCw aria-hidden className="size-3.5" />刷新</button>
    </div>
    {error && <div role="alert" className="flex items-center gap-2 border-b px-4 py-2 text-destructive"><AlertCircle aria-hidden className="size-4 shrink-0" /><span className="min-w-0 break-words">{error}</span></div>}
    {!issueRoute ? <div className="p4-dock-empty"><FolderGit2 aria-hidden /><span>打开一个任务后，查看相关待提交 CL。</span></div> : !ids.length ? <div className="p4-dock-empty"><FolderGit2 aria-hidden /><span>未找到任务单号。</span></div> : loading ? <div className="p4-dock-empty"><Loader2 aria-hidden className="animate-spin" /><span>正在查询 P4…</span></div> : <div className="flex min-h-0 flex-1 overflow-x-auto">
      <section aria-label="关联 CL" className="p4-dock-list flex w-60 shrink-0 flex-col border-r">
        <div className="p4-dock-list-heading"><span>关联 CL</span><span className="p4-dock-count">{changes.length}</span></div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {changes.length === 0 && <div className="p4-dock-list-empty">没有匹配的待提交 CL</div>}
          {changes.map((row) => <button key={`${row.client}:${row.change}`} type="button" aria-pressed={selected === row} title={`${row.desc}\n${row.client}`} onClick={() => { setError(""); if (selected !== row) { setSelection(""); setFile(null); } setSelected(row); }} className="p4-dock-item w-full text-left">
            <span className="flex items-center gap-2"><FolderGit2 aria-hidden className="size-4 shrink-0 text-primary" /><strong className="min-w-0 flex-1 truncate">CL {row.change}</strong></span>
            <span className="mt-1 block truncate pl-6">{row.desc}</span><span className="mt-0.5 block truncate pl-6 text-xs text-muted-foreground">{row.client}</span>
          </button>)}
        </div>
      </section>
      <section aria-label="文件" className="p4-dock-list flex w-56 shrink-0 flex-col border-r">
        <div className="p4-dock-list-heading"><span>文件</span>{selected && !loadingFiles && <span className="p4-dock-count">{files.length}</span>}</div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {!selected ? <div className="p4-dock-list-empty">选择 CL 查看文件</div> : loadingFiles ? <div className="p4-dock-list-empty">正在加载文件…</div> : files.length === 0 && !error ? <div className="p4-dock-list-empty">这个 CL 没有待提交文件</div> : null}
          {files.map((row) => <button key={row.depotFile} type="button" aria-pressed={file === row} title={row.depotFile} onClick={() => { setError(""); if (file !== row) setSelection(""); setFile(row); }} className="p4-dock-item flex w-full items-center gap-2 text-left">
            <FileCode2 aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{row.depotFile.split("/").at(-1)}</span><span className="p4-dock-file-action">{actionLabels[row.action] ?? row.action}</span>
          </button>)}
        </div>
      </section>
      <section aria-label="代码差异" className="flex min-w-0 flex-1 flex-col">
        <div className="p4-dock-diff-header flex min-h-11 items-center gap-3 border-b px-4">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={file?.depotFile}>{file?.depotFile ?? "选择文件查看 Diff"}</span>
          <button type="button" title={selection ? "将选中代码带入当前任务评论草稿" : "先选中需要提问的代码"} disabled={!selection || selection.length > 45000 || asking} className={`${buttonStyle} p4-dock-ask flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-medium`} onClick={() => void ask()}>{asking ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Sparkles aria-hidden className="size-3.5" />}问 AI</button>
          <button type="button" disabled={!file || !selected} className={`${buttonStyle} p4-dock-action flex shrink-0 items-center gap-1.5 px-2.5 py-1.5`} onClick={() => { if (selected && file) void window.desktopAPI.p4RevertFile(ids, selected.client, selected.change, file.depotFile).then((done) => { if (done) setRefresh((n) => n + 1); }).catch((e) => setError(String(e))); }}><Undo2 aria-hidden className="size-3.5" />撤销文件</button>
        </div>
        {loadingDiff ? <div className="p4-dock-empty"><Loader2 aria-hidden className="animate-spin" /><span>正在加载 Diff…</span></div> : diff ? <P4DiffView diff={diff} path={file?.depotFile ?? ""} onSelection={setSelection} /> : <div className="p4-dock-empty"><GitCompareArrows aria-hidden /><span>{file ? "没有可显示的文本 Diff。" : "选择文件查看代码差异"}</span><span className="text-xs">{file ? "" : "选中代码后，可以带入当前任务向 AI 提问"}</span></div>}
      </section>
    </div>}
  </div>;
}
