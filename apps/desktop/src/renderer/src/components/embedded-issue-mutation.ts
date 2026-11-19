export type EmbeddedIssueMutation = { operation: "update" | "delete"; issueIds: string[] };

/** Only explicit successful issue writes may invalidate a cached guest. */
export function parseEmbeddedIssueMutation(raw: unknown, workspaceId: string): EmbeddedIssueMutation | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as { type?: unknown; action?: { type?: unknown; data?: unknown }; mutation?: { options?: { meta?: Record<string, unknown> }; state?: { variables?: unknown; context?: unknown } } };
  const meta = event.mutation?.options?.meta, vars = event.mutation?.state?.variables;
  if (event.type !== "updated" || event.action?.type !== "success" || meta?.workspaceId !== workspaceId) return null;
  const op = meta.embeddedIssueSync;
  if (op === "delete-many" && Array.isArray(vars) && vars.length && vars.every((id) => typeof id === "string" && id)) {
    const data = event.action?.data as { deleted?: unknown } | undefined;
    return { operation: data?.deleted === vars.length ? "delete" : "update", issueIds: vars };
  }
  if (op === "create" && event.action?.data && typeof event.action.data === "object") {
    const parentId = (event.action.data as { parent_issue_id?: unknown }).parent_issue_id;
    if (typeof parentId === "string" && parentId) return { operation: "update", issueIds: [parentId] };
  }
  if (op === "delete" && typeof vars === "string" && vars) return { operation: "delete", issueIds: [vars] };
  if (!vars || typeof vars !== "object") return null;
  const value = vars as { id?: unknown; ids?: unknown; parent_issue_id?: unknown };
  if (op === "update" && typeof value.id === "string" && value.id) {
    const context = event.mutation?.state?.context as { parentId?: unknown } | undefined;
    const data = event.action?.data as { parent_issue_id?: unknown } | undefined;
    const ids = [value.id, context?.parentId, value.parent_issue_id, data?.parent_issue_id].filter((id): id is string => typeof id === "string" && !!id);
    return { operation: "update", issueIds: [...new Set(ids)] };
  }
  if (op === "update-many" && Array.isArray(value.ids) && value.ids.length > 0 && value.ids.every((id) => typeof id === "string" && id)) return { operation: "update", issueIds: value.ids };
  return null;
}
