"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useAuthStore } from "@multica/core/auth";
import { useT } from "../../i18n";
import { addDaysIso, todayIso } from "../../runtimes/utils";
import { buildPersonalTrend, isoWeekFromDate, isoWeekStart, loadPersonalSnapshot, summarizePersonalWork } from "./personal-work";

const control = "h-8 rounded-md border bg-background px-2 text-sm text-foreground";
const card = "rounded-xl border bg-card p-5";

export function PersonalWorkTab({ wsId, projectId, timeZone, filterTarget, agents, agentsLoading, agentsError }: { wsId: string; projectId: string | null; timeZone: string; filterTarget: HTMLElement | null; agents: { id: string; owner_id: string | null }[]; agentsLoading: boolean; agentsError: boolean }) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { i18n } = useT("usage");
  const zh = (i18n.resolvedLanguage ?? i18n.language).startsWith("zh");
  const s = (cn: string, en: string) => zh ? cn : en;
  const queryClient = useQueryClient();
  const today = todayIso(timeZone);
  const invalidAgents = agentsError || agents.some((agent) => !agent || typeof agent.id !== "string" || !agent.id || (agent.owner_id !== null && (typeof agent.owner_id !== "string" || !agent.owner_id)));
  const agentIds = useMemo(() => new Set(agents.filter((agent) => agent && agent.owner_id === userId && !!userId && typeof agent.id === "string").map((agent) => agent.id)), [agents, userId]);
  const [period, setPeriod] = useState("day");
  const [day, setDay] = useState(today);
  const [week, setWeek] = useState(() => isoWeekFromDate(today));
  const [from, setFrom] = useState(() => addDaysIso(today, -6));
  const [to, setTo] = useState(today);
  const weekStart = period === "week" ? isoWeekStart(week) : null;
  const scopeStart = period === "all" ? "0001-01-01" : period === "day" ? day : period === "week" ? weekStart ?? "" : from;
  const scopeEnd = period === "all" ? "9999-12-31" : period === "day" ? day : period === "week" ? weekStart ? addDaysIso(weekStart, 6) : "" : to;
  const valid = !!scopeStart && !!scopeEnd && scopeStart <= scopeEnd && (period === "all" || (Date.parse(scopeEnd) - Date.parse(scopeStart)) / 86400000 <= 365);
  const snapshot = useQuery({
    queryKey: ["personal-work", wsId, userId, projectId],
    enabled: !!wsId && !!userId && valid,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const [data, catalog] = await Promise.all([
        loadPersonalSnapshot((offset, limit) => api.listIssues({ workspace_id: wsId, ...(projectId ? { project_id: projectId } : {}), offset, limit, sort_by: "last_activity", sort_direction: "desc" }, { signal, strict: true }), (id) => api.listTimelineForStats(id, signal), signal),
        api.listIssueStatuses(true, { signal, strict: true }).then((response) => ({ statuses: response.statuses, unavailable: false })).catch((error: unknown) => { if (signal.aborted) throw error; return { statuses: [], unavailable: true }; }),
      ]);
      return { ...data, catalog };
    },
  });
  const data = useMemo(() => {
    if (!snapshot.data || !userId || !valid) return null;
    const doneStatuses = new Set(["done", ...snapshot.data.catalog.statuses.filter((status) => status.category === "done").map((status) => status.key)]);
    return summarizePersonalWork(snapshot.data.issues, snapshot.data.entries, { userId, agentIds, start: scopeStart, end: scopeEnd, timeZone, doneStatuses });
  }, [snapshot.data, userId, agentIds, valid, scopeStart, scopeEnd, timeZone]);
  const activeDates = useMemo(() => Object.keys(data?.days ?? {}).sort(), [data]);
  const start = period === "all" ? activeDates[0] ?? today : scopeStart;
  const end = period === "all" ? activeDates.at(-1) ?? today : scopeEnd;
  const trend = useMemo(() => valid ? buildPersonalTrend(data?.days ?? {}, start, end) : { grain: "day" as const, buckets: [], dayCount: 0 }, [valid, data, start, end]);
  const maxHour = Math.max(1, ...(data?.hours ?? []));
  const maxDay = Math.max(1, ...trend.buckets.map((bucket) => bucket.count));

  return <div className="space-y-6">
    {filterTarget && createPortal(<div className="flex items-center gap-2">
      <label htmlFor="personal-period" className="sr-only">{s("统计范围", "Period")}</label>
      <select id="personal-period" className={control} value={period} onChange={(e) => { if (e.target.value === "week" && period === "day" && day) setWeek(isoWeekFromDate(day)); setPeriod(e.target.value); }}><option value="day">{s("单日", "Day")}</option><option value="week">{s("按周", "Week")}</option><option value="custom">{s("自定义", "Custom")}</option><option value="all">{s("所有时间", "All time")}</option></select>
      {period === "day" && <input className={control} aria-label={s("选择日期", "Select date")} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
      {period === "week" && <input className={control} aria-label={s("选择周", "Select week")} type="week" value={week} onChange={(e) => setWeek(e.target.value)} />}
      {period === "custom" && <><input className={control} aria-label={s("开始日期", "Start date")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>—</span><input className={control} aria-label={s("结束日期", "End date")} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
    </div>, filterTarget)}
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{s("创建、评论和活动分布只统计本人；完成任务同时包含你名下可见智能体标记完成的任务。按任务最近活跃顺序最多扫描 500 个可见任务，时间线可能截断，结果可能不完整；这不是工时或效率评分。", "Creations, comments and activity reflect your own actions; completed issues also include actions by visible agents you own. Up to 500 recently active visible issues are scanned and timelines may be truncated. Results may be incomplete and are not work hours or an efficiency score.")} {s("时区", "Timezone")}: {timeZone}.</div>
    {!valid ? <p role="alert">{s("请选择有效日期，范围最长 366 天。", "Choose a valid range of up to 366 days.")}</p> : !userId ? <p>{s("请先登录。", "Sign in first.")}</p> : snapshot.isError ? <div role="alert" className={card}>{s("无法读取任务，请重试。", "Could not load issues. Try again.")} <button className="underline" onClick={() => void queryClient.invalidateQueries({ queryKey: ["personal-work", wsId] })}>{s("重试", "Retry")}</button></div> : snapshot.isLoading || !data ? <div className={card}>{s("正在读取任务时间线，任务较多时可能需要一些时间…", "Loading issue timelines; this may take a while…")}</div> : <>
      {(snapshot.data?.truncated || snapshot.data?.failed || snapshot.data?.truncatedTimelines || snapshot.data?.catalog.unavailable) ? <p role="status" className="text-sm text-muted-foreground">{s(`已扫描 ${snapshot.data.issues.length} / ${snapshot.data.total} 个任务`, `Scanned ${snapshot.data.issues.length} of ${snapshot.data.total} issues`)}{snapshot.data.failed ? s(`；${snapshot.data.failed} 个时间线读取失败`, `; ${snapshot.data.failed} timelines failed`) : ""}{snapshot.data.truncatedTimelines ? s(`；${snapshot.data.truncatedTimelines} 个时间线已截断`, `; ${snapshot.data.truncatedTimelines} timelines truncated`) : ""}{snapshot.data.catalog.unavailable ? s("；自定义完成状态不可用，仅识别内置完成状态", "; custom completion statuses unavailable") : ""}</p> : <p className="text-sm text-muted-foreground">{s(`已扫描 ${snapshot.data?.issues.length ?? 0} 个任务`, `Scanned ${snapshot.data?.issues.length ?? 0} issues`)}</p>}
      <section><h2 className="mb-3 text-lg font-semibold">{s("工作成果", "Work activity")}</h2><div className="grid gap-3 sm:grid-cols-3">{[[s("创建任务", "Created"), data.counts.created], [s("发表评论", "Comments"), data.counts.comments], [s("完成任务", "Completed issues"), agentsLoading || invalidAgents ? "—" : data.completedIssues]].map(([label, value]) => <div key={label} className={card}><div className="text-sm text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div></div>)}</div><p className="mt-2 text-xs text-muted-foreground">{invalidAgents ? s("智能体列表读取失败，无法计算完成任务数；请刷新重试。", "Could not load agents; refresh to calculate completed issues.") : agentsLoading ? s("正在读取智能体归属…", "Loading agent ownership…") : s("完成任务按本人及当前名下智能体在所选范围内标记完成的不同任务数统计；重复完成只计一次，之后重新打开也会计入。", "Counts distinct issues marked complete by you or your currently owned agents in the selected period. Repeated completions count once; later reopened issues remain included.")}</p></section>
      <section><h2 className="mb-3 text-lg font-semibold">{s("工作摘要", "Activity highlights")}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><div className="text-sm text-muted-foreground">{s("活跃天数", "Active days")}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{data.activeDays}</div><div className="mt-1 text-xs text-muted-foreground">{period === "all" ? s("有操作记录的不同天数", "Distinct days with activity") : s(`所选 ${trend.dayCount} 天中有操作的天数`, `Days with activity out of ${trend.dayCount}`)}</div></div>
        <div className={card}><div className="text-sm text-muted-foreground">{s("任务覆盖", "Issues touched")}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{data.touchedIssues}</div><div className="mt-1 text-xs text-muted-foreground">{s("有本人操作记录的不同任务数", "Distinct issues with your activity")}</div></div>
        <div className={card}><div className="text-sm text-muted-foreground">{s("最忙的一天", "Busiest day")}</div><div className="mt-2 text-xl font-semibold tabular-nums">{data.busiestDay?.date ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground">{data.busiestDay ? s(`${data.busiestDay.count} 次操作`, `${data.busiestDay.count} actions`) : s("暂无记录", "No activity")}</div></div>
        <div className={card}><div className="text-sm text-muted-foreground">{s("活跃时段", "Peak hour")}</div><div className="mt-2 text-xl font-semibold tabular-nums">{data.peakHour ? `${String(data.peakHour.hour).padStart(2, "0")}:00 – ${String((data.peakHour.hour + 1) % 24).padStart(2, "0")}:00` : "—"}</div><div className="mt-1 text-xs text-muted-foreground">{data.peakHour ? s(`${data.peakHour.count} 次操作`, `${data.peakHour.count} actions`) : s("暂无记录", "No activity")}</div></div>
      </div><p className="mt-2 text-xs text-muted-foreground">{s("操作次数相同时，显示最早的日期或时段。", "When counts tie, the earliest date or hour is shown.")}</p></section>
      <section><h2 className="mb-3 text-lg font-semibold">{s("操作构成", "Activity mix")}</h2><div className={`${card} space-y-4`}>{[[s("创建任务", "Created"), data.counts.created], [s("发表评论", "Comments"), data.counts.comments], [s("状态变更", "Status changes"), data.counts.statuses]].map(([label, value]) => { const count = Number(value); const total = data.counts.created + data.counts.comments + data.counts.statuses; const percent = total ? count / total * 100 : 0; return <div key={label}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{count} · {Math.round(percent)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${percent}%` }} /></div></div>; })}<p className="text-xs text-muted-foreground">{s("标记完成已包含在状态变更中，不重复计入构成。", "Completions are included in status changes and are not counted twice.")}</p></div></section>
      <section><h2 className="mb-3 text-lg font-semibold">{s("工作节奏", "Activity rhythm")}</h2><div className={card}><p className="text-sm text-muted-foreground">{s("每小时操作次数", "Actions by hour")}</p><div className="mt-5 flex gap-2"><div aria-label={s("操作次数纵轴", "Action count axis")} className="flex h-32 w-8 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground"><span>{maxHour}</span><span>0</span></div><div className="min-w-0 flex-1"><div className="flex h-32 items-end gap-1 border-b border-l">{data.hours.map((count, hour) => <div key={hour} className="flex h-full min-w-0 flex-1 items-end" title={`${String(hour).padStart(2, "0")}:00 · ${count}`}><div className="w-full rounded-t bg-primary/70" style={{ height: `${count / maxHour * 100}%` }} /></div>)}</div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:00</span></div></div></div></div></section>
      <section><h2 className="mb-3 text-lg font-semibold">{trend.grain === "day" ? s("每日趋势", "Daily trend") : trend.grain === "month" ? s("每月趋势", "Monthly trend") : s("每年趋势", "Yearly trend")}</h2><div className={card}><p className="text-sm text-muted-foreground">{period === "all" && activeDates.length === 0 ? s("暂无操作记录", "No activity recorded") : `${start} — ${end}`} · {trend.grain === "day" ? s("每天的操作次数", "Actions per day") : trend.grain === "month" ? s("每月的操作次数", "Actions per month") : s("每年的操作次数", "Actions per year")}</p><div className="mt-4 flex gap-2"><div aria-label={s("操作次数纵轴", "Action count axis")} className="flex h-32 w-8 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground"><span>{maxDay}</span><span>0</span></div><div className="min-w-0 flex-1 overflow-x-auto"><div className="flex h-32 min-w-full items-end gap-1 border-b border-l" style={{ width: `${Math.max(100, trend.buckets.length * 18)}px` }}>{trend.buckets.map(({ label, count }) => <div key={label} title={`${label}: ${count}`} aria-label={`${label}: ${count}`} className="flex h-full min-w-2 flex-1 items-end"><div className="w-full rounded-t bg-primary/70" style={{ height: `${count / maxDay * 100}%` }} /></div>)}</div></div></div><div className="ml-10 mt-2 flex justify-between text-xs text-muted-foreground"><span>{period === "all" && activeDates.length === 0 ? "—" : start}</span><span>{period === "all" && activeDates.length === 0 ? "—" : end}</span></div></div></section>
    </>}
  </div>;
}
