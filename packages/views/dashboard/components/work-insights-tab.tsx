"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { workspaceKeys } from "@multica/core/workspace/queries";
import type { Agent } from "@multica/core/types";
import { addDaysIso, todayIso } from "../../runtimes/utils";
import { useT } from "../../i18n";
import { calculateInsights, dateFromParts, loadTaskHistory } from "./work-insights";

const control = "h-8 rounded-md border bg-background px-2 text-sm text-foreground";
const panel = "rounded-xl border bg-card p-5";

function duration(seconds: number, zh: boolean) {
  const minutes = Math.floor(seconds / 60);
  return zh ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function WorkInsightsTab({ wsId, agents, agentsLoading, agentsError, projectId, timeZone, filterTarget }: { wsId: string; agents: Agent[]; agentsLoading: boolean; agentsError: boolean; projectId: string | null; timeZone: string; filterTarget: HTMLElement | null }) {
  const { i18n } = useT("usage");
  const zh = (i18n.resolvedLanguage ?? i18n.language).startsWith("zh");
  const s = (cn: string, en: string) => zh ? cn : en;
  const today = todayIso(timeZone);
  const [period, setPeriod] = useState("90");
  const [from, setFrom] = useState(() => addDaysIso(today, -89));
  const [to, setTo] = useState(today);
  const [agentId, setAgentId] = useState("");
  const start = period === "custom" ? from : addDaysIso(today, -(Number(period) - 1));
  const end = period === "custom" ? to : today;
  const valid = !!start && !!end && start <= end && (Date.parse(end) - Date.parse(start)) / 86400000 <= 3659;
  const selectedAgent = agents.some((agent) => agent.id === agentId) ? agentId : "";
  const agentIds = useMemo(() => agents.map((agent) => agent.id).sort(), [agents]);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["work-insights", wsId, "history", agentIds],
    enabled: !agentsLoading && !agentsError && valid,
    staleTime: 60_000,
    queryFn: ({ signal }) => loadTaskHistory(agentIds, async (id, before) => {
      const page = await api.listAgentTasksPage(id, { limit: 200, before, signal });
      return { ...page, tasks: page.tasks.map(({ id: taskId, agent_id, issue_id, started_at, completed_at }) => ({ id: taskId, agent_id, issue_id, started_at, completed_at })) };
    }),
    retry: false,
  });
  const relevantIssues = useMemo(() => {
    if (!history.data || !valid || !projectId) return [];
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    return [...new Set(history.data.filter((task) => {
      if (!task.issue_id || !task.started_at || (selectedAgent && task.agent_id !== selectedAgent)) return false;
      const timestamp = Date.parse(task.started_at);
      if (!Number.isFinite(timestamp)) return false;
      const date = dateFromParts(formatter, timestamp);
      return date >= start && date <= end;
    }).map((task) => task.issue_id))].sort();
  }, [history.data, valid, projectId, timeZone, selectedAgent, start, end]);
  const issues = useQuery({
    queryKey: ["work-insights", wsId, "project", projectId, relevantIssues],
    enabled: !!projectId && valid && !!history.data,
    staleTime: 60_000,
    queryFn: async () => {
      const ids = new Set<string>();
      for (let offset = 0; offset < relevantIssues.length; offset += 50) {
        const page = await api.listIssues({ workspace_id: wsId, project_id: projectId!, ids: relevantIssues.slice(offset, offset + 50), limit: 100 });
        for (const issue of page.issues) ids.add(issue.id);
      }
      return ids;
    },
    retry: false,
  });
  const data = useMemo(() => valid && history.data && (!projectId || issues.data)
    ? calculateInsights(history.data, { start, end, timeZone, agentId: selectedAgent || null, issueIds: projectId ? issues.data! : null }) : null,
  [valid, history.data, issues.data, projectId, start, end, timeZone, selectedAgent]);
  const dates = useMemo(() => {
    if (!valid) return [];
    const count = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    return Array.from({ length: count }, (_, i) => addDaysIso(start, i));
  }, [valid, start, end]);
  const name = (id?: string) => agents.find((agent) => agent.id === id)?.name ?? "—";
  const busiest = data ? Object.entries(data.days).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] : undefined;
  const night = data?.agents.filter((a) => a.nightCount > 0).sort((a, b) => b.nightCount - a.nightCount || a.id.localeCompare(b.id))[0];
  const attendance = data?.agents.toSorted((a, b) => b.activeDays - a.activeDays || a.id.localeCompare(b.id))[0];
  const maxDay = data ? Math.max(1, ...Object.values(data.days)) : 1;
  const maxHour = data ? Math.max(1, ...data.hours) : 1;
  const failed = agentsError || history.isError || (!!projectId && issues.isError);
  const loading = agentsLoading || history.isLoading || (!!projectId && issues.isLoading);

  return <div className="space-y-6">
    {filterTarget && createPortal(<div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="insights-period">{s("统计时间", "Period")}</label>
      <select id="insights-period" className={control} value={period} onChange={(event) => setPeriod(event.target.value)}>
        {[7, 30, 90, 180].map((n) => <option key={n} value={n}>{s(`近 ${n} 天`, `Last ${n} days`)}</option>)}
        <option value="custom">{s("自定义日期", "Custom dates")}</option>
      </select>
      {period === "custom" && <><input aria-label={s("开始日期", "Start date")} className={control} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><span>—</span><input aria-label={s("结束日期", "End date")} className={control} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
      <label className="sr-only" htmlFor="insights-agent">{s("智能体", "Agent")}</label>
      <select id="insights-agent" className={control} value={selectedAgent} onChange={(e) => setAgentId(e.target.value)}><option value="">{s("全部智能体", "All agents")}</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>
    </div>, filterTarget)}
    <p className="text-xs text-muted-foreground">{s("按任务开始时间统计，时区", "Tasks counted by start time; timezone")}: {timeZone} · {s("仅包含你有权查看的智能体，已删除智能体不计入；指定项目按任务单当前归属统计。", "Only agents you can access are included; deleted agents are excluded. Project filtering uses the issue’s current project.")}</p>
    {!valid ? <p role="alert">{s("请选择有效日期，范围最长 10 年。", "Choose a valid range of up to 10 years.")}</p> : failed ? <div role="alert" className={panel}><p>{s("统计数据加载失败，请重试。", "Could not load statistics. Please retry.")}</p><button className="mt-3 underline" onClick={() => { void queryClient.invalidateQueries({ queryKey: ["work-insights", wsId] }); void queryClient.invalidateQueries({ queryKey: workspaceKeys.agents(wsId) }); }}>{s("重试", "Retry")}</button></div> : loading || !data ? <div className={panel}>{s("正在读取任务历史，数据较多时可能需要一些时间…", "Loading task history; this may take a while…")}</div> : <>
      <section className={`${panel} bg-muted/30`}><div className="text-xs font-medium tracking-widest text-muted-foreground">{s("工作空间 · 工作概览", "WORKSPACE · OVERVIEW")}</div><h2 className="mt-2 text-xl font-semibold">{s("每一次运行，都留下了进展。", "Every run is progress.")}</h2><div className="mt-5 flex flex-wrap gap-10"><div><strong className="text-2xl">{data.total}</strong><p className="text-sm text-muted-foreground">{s("次运行", "runs")}</p></div><div><strong className="text-2xl">{duration(data.totalSeconds, zh)}</strong><p className="text-sm text-muted-foreground">{s("已结束运行的累计时长", "completed run time")}</p></div><div><strong className="text-2xl">{data.agents.length}</strong><p className="text-sm text-muted-foreground">{s("位智能体参与", "agents")}</p></div></div></section>
      <section><h2 className="mb-1 text-lg font-semibold">{s("工作日历", "Work calendar")}</h2><p className="mb-3 text-sm text-muted-foreground">{s("每格代表一天，颜色越深代表运行越活跃。", "Each square is a day; darker means more runs.")}</p><div className={panel}><div className="mb-3 text-sm text-muted-foreground">{start} — {end} · {s(`${Object.keys(data.days).length} 天有运行`, `${Object.keys(data.days).length} active days`)}</div><div className="flex flex-wrap gap-1">{dates.map((date) => { const count = data.days[date] ?? 0; const opacity = count ? 0.25 + 0.75 * count / maxDay : 0.08; return <span key={date} title={`${date}: ${count}`} aria-label={`${date}: ${count}`} className="size-3 rounded-[3px] bg-primary" style={{ opacity }} />; })}</div></div></section>
      <div className="grid gap-6 lg:grid-cols-2"><section><h2 className="mb-3 text-lg font-semibold">{s("范围战报", "Highlights")}</h2><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{[[s("最活跃", "Most active"), name(data.agents[0]?.id), data.agents[0] ? s(`${data.agents[0].count} 次运行`, `${data.agents[0].count} runs`) : "—"], [s("最长一次运行", "Longest run"), name(data.longest?.agentId), data.longest ? duration(data.longest.seconds, zh) : "—"], [s("最忙的一天", "Busiest day"), busiest?.[0] ?? "—", busiest ? s(`${busiest[1]} 次运行`, `${busiest[1]} runs`) : "—"]].map(([label, value, detail]) => <div key={label} className={panel}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-3 break-words font-semibold">{value}</div><div className="mt-1 text-sm text-muted-foreground">{detail}</div></div>)}</div></section>
      <section><h2 className="mb-3 text-lg font-semibold">{s("荣誉墙", "Hall of fame")}</h2><div className={`${panel} space-y-4`}>{[["☾", s("夜猫子", "Night owl"), night?.id, night ? s(`${night.nightCount} 次`, `${night.nightCount} runs`) : "—", s("22:00 至次日 06:00 开始的运行次数最多", "Most runs started between 22:00 and 06:00")], ["✿", s("出勤达人", "Regular"), attendance?.id, attendance ? s(`${attendance.activeDays} 天`, `${attendance.activeDays} days`) : "—", s("有运行记录的日期最多", "Most active days")], ["⌁", s("长跑选手", "Marathoner"), data.longest?.agentId, data.longest ? duration(data.longest.seconds, zh) : "—", s("已结束的单次运行时间最长", "Longest completed run")]].map(([icon, label, id, detail, rule]) => <div key={label} title={rule} className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-lg">{icon}</span><div className="min-w-0 flex-1"><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{rule}</div></div><div className="text-right text-sm"><div>{name(id)}</div><div className="text-muted-foreground">{detail}</div></div></div>)}</div></section></div>
      <section><h2 className="mb-3 text-lg font-semibold">{s("工作节奏", "Daily rhythm")}</h2><div className={panel}><p className="text-sm text-muted-foreground">{s("24 小时运行分布 · 按任务开始时间", "Runs by hour · based on start time")}</p><div className="mt-5 flex gap-2"><div aria-label={s("运行次数纵轴", "Runs axis")} className="relative h-32 w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground"><span className="absolute right-0 top-0 -translate-y-1/2">{maxHour}</span>{maxHour > 1 && <span className="absolute right-0 -translate-y-1/2" style={{ bottom: `${Math.floor(maxHour / 2) / maxHour * 100}%`, transform: "translateY(50%)" }}>{Math.floor(maxHour / 2)}</span>}<span className="absolute bottom-0 right-0 translate-y-1/2">0</span></div><div className="min-w-0 flex-1"><div className="relative h-32 border-b border-l border-border"><div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />{maxHour > 1 && <div className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${Math.floor(maxHour / 2) / maxHour * 100}%` }} />}<div className="relative flex h-full items-end gap-1">{data.hours.map((count, hour) => <div key={hour} className="flex h-full min-w-0 flex-1 items-end" title={`${String(hour).padStart(2, "0")}:00 · ${count}`} aria-label={`${hour}:00 ${count}`}><div className="w-full rounded-t bg-primary/70" style={{ height: `${count / maxHour * 100}%` }} /></div>)}</div></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:00</span></div></div></div></div></section>
    </>}
  </div>;
}
