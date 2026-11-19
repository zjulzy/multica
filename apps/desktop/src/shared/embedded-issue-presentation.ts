export type EmbeddedIssuePresentation = {
  surface: "main" | "page" | "dock";
  highlightCommentId?: string;
  highlightRequestToken?: number;
  shellHeader?: boolean;
};

export function parseEmbeddedIssuePresentation(raw: unknown): EmbeddedIssuePresentation | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  if (input.surface !== "main" && input.surface !== "page" && input.surface !== "dock") return null;
  if (input.shellHeader !== undefined && (typeof input.shellHeader !== "boolean" || (input.shellHeader && input.surface !== "main"))) return null;
  if (input.highlightCommentId !== undefined && (typeof input.highlightCommentId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(input.highlightCommentId))) return null;
  if (input.highlightRequestToken !== undefined && (!Number.isSafeInteger(input.highlightRequestToken) || (input.highlightRequestToken as number) < 0)) return null;
  return { surface: input.surface, ...(typeof input.shellHeader === "boolean" ? { shellHeader: input.shellHeader } : {}), ...(typeof input.highlightCommentId === "string" ? { highlightCommentId: input.highlightCommentId } : {}), ...(typeof input.highlightRequestToken === "number" ? { highlightRequestToken: input.highlightRequestToken } : {}) };
}
