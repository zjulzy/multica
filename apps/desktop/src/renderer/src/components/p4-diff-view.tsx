import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { highlightToLines, languageForPath } from "../../../../../../packages/views/common/task-transcript/diff-highlight";
import "../../../../../../packages/views/editor/styles/code.css";
import { parseP4Diff } from "./p4-diff-lines";

type Match = { line: number; start: number; end: number };
export const P4DiffView = memo(function P4DiffView({ diff, path, onSelection, onLoadFullContext }: { diff: string; path: string; onSelection: (text: string) => void; onLoadFullContext?: () => Promise<string> }) {
  const [fullDiff, setFullDiff] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [block, setBlock] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Promise<string> | null>(null);
  const content = expanded && fullDiff !== null ? fullDiff : diff;
  const lines = useMemo(() => parseP4Diff(content), [content]);
  const blocks = useMemo(() => {
    const indices: number[] = [];
    let inChange = false;
    lines.forEach((line, index) => {
      const changed = line.kind === "add" || line.kind === "remove";
      if (changed && !inChange) indices.push(index);
      inChange = changed;
    });
    return indices;
  }, [lines]);
  const matches = useMemo(() => {
    const result: Match[] = [];
    const needle = query.toLocaleLowerCase();
    if (!needle) return result;
    lines.forEach((line, index) => {
      if (line.kind === "hunk" || line.kind === "message") return;
      const text = line.text.toLocaleLowerCase();
      let pos = text.indexOf(needle);
      while (pos !== -1) { result.push({ line: index, start: pos, end: pos + needle.length }); pos = text.indexOf(needle, pos + needle.length); }
    });
    return result;
  }, [lines, query]);
  const highlighted = useMemo(() => {
    const language = languageForPath(path);
    if (!language || content.length > 500_000) return null;
    const oldText = lines.filter((line) => line.kind === "context" || line.kind === "remove").map((line) => line.text).join("\n");
    const newText = lines.filter((line) => line.kind === "context" || line.kind === "add").map((line) => line.text).join("\n");
    return { old: highlightToLines(oldText, language), new: highlightToLines(newText, language) };
  }, [lines, path, content.length]);
  const load = async () => {
    if (fullDiff !== null) { setExpanded(true); return; }
    if (!onLoadFullContext) return;
    setLoading(true); setError("");
    try {
      pending.current ??= onLoadFullContext();
      const value = await pending.current;
      setFullDiff(value); setExpanded(true);
    } catch { setError("无法加载完整代码，请重试。"); }
    finally { pending.current = null; setLoading(false); }
  };
  const openFind = () => { setFindOpen(true); void load(); };
  useEffect(() => { if (findOpen) inputRef.current?.focus(); }, [findOpen]);
  const scrollToLine = (index: number) => {
    const container = scrollRef.current;
    const element = container?.querySelector<HTMLElement>(`[data-line-index="${index}"]`);
    if (!container || !element) return;
    const rect = element.getBoundingClientRect(), parent = container.getBoundingClientRect();
    container.scrollTop += rect.top - parent.top - container.clientHeight / 2;
  };
  useEffect(() => {
    const registry = typeof CSS !== "undefined" ? CSS.highlights : undefined;
    if (!registry || typeof Highlight === "undefined") return;
    const all = new Highlight(), current = new Highlight();
    matches.forEach((match, index) => {
      const root = scrollRef.current?.querySelector<HTMLElement>(`[data-code-index="${match.line}"]`);
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let offset = 0, first: Text | null = null, last: Text | null = null, start = 0, end = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text, next = offset + text.length;
        if (!first && match.start < next) { first = text; start = match.start - offset; }
        if (first && match.end <= next) { last = text; end = match.end - offset; break; }
        offset = next;
      }
      if (!first || !last) return;
      const range = document.createRange(); range.setStart(first, start); range.setEnd(last, end);
      all.add(range); if (index === active % matches.length) current.add(range);
    });
    registry.set("p4-find", all); registry.set("p4-find-active", current);
    return () => { registry.delete("p4-find"); registry.delete("p4-find-active"); };
  }, [matches, active]);
  useEffect(() => { if (matches.length) scrollToLine(matches[active % matches.length]!.line); }, [matches, active]);
  const capture = (element: HTMLElement) => {
    const selected = window.getSelection();
    onSelection(selected && element.contains(selected.anchorNode) && element.contains(selected.focusNode) ? selected.toString() : "");
  };
  let oldIndex = 0, newIndex = 0;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); event.stopPropagation(); openFind(); }
    else if (findOpen && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setFindOpen(false); setQuery(""); }
  }}>
    <div className="p4-diff-controls flex items-center gap-1 border-b px-3 py-1">
      <button type="button" className="p4-diff-button p4-find-trigger" title="搜索当前文件 (Ctrl+F)" aria-label="搜索当前文件" onClick={openFind}><Search size={15} /></button>
      <button type="button" className="p4-diff-button" title="上一个变更" aria-label="上一个变更" disabled={!blocks.length} onClick={() => { const next = block < 0 ? blocks.length - 1 : (block - 1 + blocks.length) % blocks.length; setBlock(next); scrollToLine(blocks[next]!); }}><ChevronUp size={15} /></button>
      <button type="button" className="p4-diff-button" title="下一个变更" aria-label="下一个变更" disabled={!blocks.length} onClick={() => { const next = (block + 1) % blocks.length; setBlock(next); scrollToLine(blocks[next]!); }}><ChevronDown size={15} /></button>
      {onLoadFullContext && <button type="button" className="p4-diff-button px-2" disabled={loading} onClick={() => expanded ? setExpanded(false) : void load()}>{loading ? "加载中…" : expanded ? "收起上下文" : "展开完整代码"}</button>}
      {findOpen && <div className="ml-auto flex items-center gap-1"><input ref={inputRef} aria-label="搜索当前文件" placeholder="搜索当前文件" className="p4-diff-search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={(event) => { if (event.key === "Enter" && matches.length) { event.preventDefault(); setActive((n) => (n + (event.shiftKey ? matches.length - 1 : 1)) % matches.length); } }} /><span className="min-w-12 text-center text-xs text-muted-foreground">{matches.length ? active % matches.length + 1 : 0} / {matches.length}</span><button type="button" aria-label="上一个匹配" className="p4-diff-button" disabled={!matches.length} onClick={() => setActive((n) => (n + matches.length - 1) % matches.length)}><ChevronUp size={15} /></button><button type="button" aria-label="下一个匹配" className="p4-diff-button" disabled={!matches.length} onClick={() => setActive((n) => (n + 1) % matches.length)}><ChevronDown size={15} /></button><button type="button" aria-label="关闭搜索" className="p4-diff-button" onClick={() => { setFindOpen(false); setQuery(""); }}><X size={15} /></button></div>}
    </div>
    {error && <div role="alert" className="px-3 py-1 text-destructive">{error}</div>}
    <div ref={scrollRef} tabIndex={0} role="region" aria-label="Diff" className="transcript-code min-h-0 min-w-0 flex-1 select-text overflow-auto bg-background font-mono text-xs leading-6" onMouseUp={(event) => capture(event.currentTarget)} onKeyUp={(event) => capture(event.currentTarget)}>
      <pre className="m-0 min-w-max whitespace-pre py-2 font-inherit">{lines.map((line, index) => {
        if (line.kind === "hunk" || line.kind === "message") return <Fragment key={index}><span data-kind={line.kind} className={line.kind === "hunk" ? "select-none bg-muted/40 px-4 text-muted-foreground" : "px-4 text-muted-foreground"}>{line.text}</span>{"\n"}</Fragment>;
        const oldHtml = line.kind !== "add" ? highlighted?.old?.[oldIndex++] : undefined;
        const newHtml = line.kind !== "remove" ? highlighted?.new?.[newIndex++] : undefined;
        const html = line.kind === "remove" ? oldHtml : newHtml;
        return <Fragment key={index}><span data-line-index={index} data-kind={line.kind} className={line.kind === "add" ? "bg-success/10" : line.kind === "remove" ? "bg-destructive/10" : ""}>
          <span aria-hidden className="sticky left-0 z-[1] inline-block w-20 select-none border-r bg-background/90 px-2 text-right text-muted-foreground/65"><span className="inline-block w-7">{line.oldLine ?? ""}</span><span className="inline-block w-7">{line.newLine ?? ""}</span></span>
          <span className={`inline-block w-6 text-center ${line.kind === "add" ? "text-success" : line.kind === "remove" ? "text-destructive" : "text-muted-foreground"}`}>{line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}</span>
          {html !== undefined ? <span data-code-index={index} className="hljs pr-6" dangerouslySetInnerHTML={{ __html: html }} /> : <span data-code-index={index} className="pr-6">{line.text}</span>}
        </span>{"\n"}</Fragment>;
      })}</pre>
    </div>
  </div>;
});
