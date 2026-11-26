import { describe, expect, it } from "vitest";
import type { Agent, AgentTask, Issue } from "@multica/core/types";
import { parseMentions } from "@multica/core/issues/comment-trigger-outcomes";
import { BaseMentionExtension } from "../../../../../../packages/views/editor/extensions/mention-extension";
import { chooseP4AskAgent, formatP4AskMention } from "./p4-ask-agent";

const idA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const idB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const agent = (id: string, name: string, extra: Partial<Agent> = {}) => ({ id, name, owner_id: "me", archived_at: null, runtime_id: "runtime", permission_mode: "private", invocation_targets: [], ...extra } as Agent);
const issue = (extra: Partial<Issue> = {}) => ({ id: "issue-1", assignee_type: "member", assignee_id: "me", ...extra } as Issue);
const task = (id: string, date: string, issueId = "issue-1") => ({ agent_id: id, issue_id: issueId, created_at: date } as AgentTask);

describe("P4 question agent selection", () => {
  it("prefers the issue's assigned agent over a more recent run", () => {
    expect(chooseP4AskAgent(issue({ assignee_type: "agent", assignee_id: idA }), [task(idB, "2026-11-26T00:00:00Z")], [agent(idA, "A"), agent(idB, "B")], "me", "member")?.id).toBe(idA);
  });
  it("otherwise picks the most recent usable agent for this issue", () => {
    const tasks = [task(idA, "2026-11-25T00:00:00Z"), task(idB, "2026-11-26T00:00:00Z"), task(idA, "2026-11-27T00:00:00Z", "other")];
    expect(chooseP4AskAgent(issue(), tasks, [agent(idA, "A"), agent(idB, "B")], "me", "member")?.id).toBe(idB);
  });
  it("skips archived, inaccessible and unbound agents; returns nothing when no eligible agent exists", () => {
    const tasks = [task(idA, "2026-11-26T00:00:00Z"), task(idB, "2026-11-25T00:00:00Z")];
    expect(chooseP4AskAgent(issue(), tasks, [agent(idA, "A", { archived_at: "2026-01-01" }), agent(idB, "B", { owner_id: "other" })], "me", "member")).toBeNull();
    expect(chooseP4AskAgent(issue(), tasks, [agent(idA, "A", { runtime_id: "" })], "me", "member")).toBeNull();
  });
  it("creates an escaped, parseable mention for agent names containing brackets", () => {
    const mention = formatP4AskMention(agent(idA, "[lizeyu] 代码助手"));
    expect(mention).toBe(`[@\\[lizeyu\\] 代码助手](mention://agent/${idA})`);
    expect(parseMentions(mention)).toMatchObject([{ type: "agent", id: idA }]);
    const tokenize = BaseMentionExtension.config.markdownTokenizer!.tokenize as (source: string) => { attributes: Record<string, string> } | undefined;
    expect(tokenize(mention)?.attributes).toMatchObject({ type: "agent", id: idA, label: "[lizeyu] 代码助手" });
  });
});
