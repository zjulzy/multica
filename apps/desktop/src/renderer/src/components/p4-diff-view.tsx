import { Fragment, memo, useMemo } from "react";
import { highlightToLines, languageForPath } from "../../../../../../packages/views/common/task-transcript/diff-highlight";
import "../../../../../../packages/views/editor/styles/code.css";
import { parseP4Diff } from "./p4-diff-lines";

export const P4DiffView = memo(function P4DiffView({ diff, path, onSelection }: { diff: string; path: string; onSelection: (text: string) => void }) {
  const lines = useMemo(() => parseP4Diff(diff), [diff]);
  const highlighted = useMemo(() => {
    const language = languageForPath(path);
    if (!language || diff.length > 500_000) return null;
    const oldText = lines.filter((line) => line.kind === "context" || line.kind === "remove").map((line) => line.text).join("\n");
    const newText = lines.filter((line) => line.kind === "context" || line.kind === "add").map((line) => line.text).join("\n");
    return { old: highlightToLines(oldText, language), new: highlightToLines(newText, language) };
  }, [lines, path, diff.length]);
  let oldIndex = 0, newIndex = 0;
  const capture = (element: HTMLElement) => {
    const selected = window.getSelection();
    onSelection(selected && element.contains(selected.anchorNode) && element.contains(selected.focusNode) ? selected.toString() : "");
  };
  return <div tabIndex={0} role="region" aria-label="Diff" className="transcript-code min-h-0 flex-1 select-text overflow-auto bg-background font-mono text-xs leading-6" onMouseUp={(event) => capture(event.currentTarget)} onKeyUp={(event) => capture(event.currentTarget)}>
    <pre className="m-0 min-w-max whitespace-pre py-2 font-inherit">{lines.map((line, index) => {
      if (line.kind === "hunk" || line.kind === "message") return <Fragment key={index}><span data-kind={line.kind} className={line.kind === "hunk" ? "select-none bg-muted/40 px-4 text-muted-foreground" : "px-4 text-muted-foreground"}>{line.text}</span>{"\n"}</Fragment>;
      const oldHtml = line.kind !== "add" ? highlighted?.old?.[oldIndex++] : undefined;
      const newHtml = line.kind !== "remove" ? highlighted?.new?.[newIndex++] : undefined;
      const html = line.kind === "remove" ? oldHtml : newHtml;
      return <Fragment key={index}><span data-kind={line.kind} className={line.kind === "add" ? "bg-success/10" : line.kind === "remove" ? "bg-destructive/10" : ""}>
        <span aria-hidden className="sticky left-0 z-[1] inline-block w-20 select-none border-r bg-background/90 px-2 text-right text-muted-foreground/65"><span className="inline-block w-7">{line.oldLine ?? ""}</span><span className="inline-block w-7">{line.newLine ?? ""}</span></span>
        <span className={`inline-block w-6 text-center ${line.kind === "add" ? "text-success" : line.kind === "remove" ? "text-destructive" : "text-muted-foreground"}`}>{line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}</span>
        {html !== undefined ? <span className="hljs pr-6" dangerouslySetInnerHTML={{ __html: html }} /> : <span className="pr-6">{line.text}</span>}
      </span>{"\n"}</Fragment>;
    })}</pre>
  </div>;
});
