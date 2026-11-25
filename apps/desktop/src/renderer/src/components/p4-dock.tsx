import { useEffect, useMemo, useState } from "react";
import { useCanonicalIssue } from "@multica/core/issues/canonical-id";
import { useRenderedRouteStore } from "@/stores/rendered-route-store";
import { parsePinnedIssueRoute } from "./pinned-issue-route";
import { issueIdentifiers } from "../../../shared/p4-issue-match";
import { P4DiffView } from "./p4-diff-view";

type Row = Record<string, string>;
export function P4Dock({ workspaceId }: { workspaceId: string }) {
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
    if (!selected) return;
    void window.desktopAPI.p4ChangeFiles(ids, selected.client, selected.change).then((value) => { if (!cancelled) setFiles(value); }).catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [selected, ids]);
  useEffect(() => {
    let cancelled = false;
    setDiff(""); setSelection("");
    if (!selected || !file) return;
    void window.desktopAPI.p4FileDiff(ids, selected.client, selected.change, file.depotFile).then((value) => { if (!cancelled) setDiff(value); }).catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [selected, file, ids]);
  const ask = () => {
    if (!canonicalId || !selected || !file || !selection || selection.length > 45000) return;
    const ticks = "`".repeat(Math.max(3, ...Array.from(selection.matchAll(/`+/g), (m) => m[0].length + 1)));
    const text = `请帮我看看以下代码：\n\nCL ${selected.change} · ${file.depotFile}\n\n${ticks}diff\n${selection}\n${ticks}\n\n我的问题：`;
    window.dispatchEvent(new CustomEvent("multica:append-issue-comment", { detail: { issueId: canonicalId, text } }));
  };
  return <div className="flex min-h-0 flex-1 flex-col text-sm">
    <div className="flex items-center gap-3 border-b px-3 py-2"><strong>P4</strong><span className="min-w-0 flex-1 truncate">{issue?.identifier ?? "请先打开任务"}</span><button type="button" className="rounded border px-2 py-1 hover:bg-accent" onClick={() => setRefresh((n) => n + 1)}>刷新</button></div>
    {error && <div role="alert" className="px-3 py-2 text-destructive">{error}</div>}
    {!issueRoute ? <div className="p-4 text-muted-foreground">打开一个任务后，查看相关待提交 CL。</div> : !ids.length ? <div className="p-4 text-muted-foreground">未找到任务单号。</div> : loading ? <div className="p-4">正在查询 P4…</div> : <div className="flex min-h-0 flex-1">
      <div className="w-64 shrink-0 overflow-auto border-r p-2">{changes.length === 0 && <div className="p-2 text-muted-foreground">没有匹配的待提交 CL</div>}{changes.map((row) => <button key={`${row.client}:${row.change}`} type="button" onClick={() => { setError(""); setSelected(row); }} className={`block w-full rounded p-2 text-left hover:bg-accent ${selected === row ? "bg-accent" : ""}`}><strong>CL {row.change}</strong><div className="truncate">{row.desc}</div><div className="truncate text-muted-foreground">{row.client}</div></button>)}</div>
      <div className="w-64 shrink-0 overflow-auto border-r p-2">{files.map((row) => <button key={row.depotFile} type="button" title={row.depotFile} onClick={() => { setError(""); setFile(row); }} className={`block w-full truncate rounded p-2 text-left hover:bg-accent ${file === row ? "bg-accent" : ""}`}>{row.action} · {row.depotFile.split("/").at(-1)}</button>)}</div>
      <div className="flex min-w-0 flex-1 flex-col"><div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-2"><span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={file?.depotFile}>{file?.depotFile ?? "选择文件查看 Diff"}</span><button type="button" disabled={!selection || selection.length > 45000} className="rounded-md border bg-background px-3 py-1.5 font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-40" onClick={ask}>问 AI</button><button type="button" disabled={!file || !selected} className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40" onClick={() => { if (selected && file) void window.desktopAPI.p4RevertFile(ids, selected.client, selected.change, file.depotFile).then((done) => { if (done) setRefresh((n) => n + 1); }).catch((e) => setError(String(e))); }}>撤销文件</button></div>{diff ? <P4DiffView diff={diff} path={file?.depotFile ?? ""} onSelection={setSelection} /> : <div className="p-4 text-muted-foreground">{file ? "没有可显示的文本 Diff。" : ""}</div>}</div>
    </div>}
  </div>;
}
