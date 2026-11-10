import type { DesktopPerformanceSnapshot, DesktopProcessKind } from "../shared/performance-monitor";

type Metric = { pid: number; type: string; cpu: { percentCPUUsage: number }; memory: { workingSetSize: number } };
type Renderer = { pid: number; kind: "window" | "cache" };
export function buildPerformanceSnapshot(metrics: Metric[], renderers: Renderer[], cpuReady: boolean, sampledAt: number): DesktopPerformanceSnapshot {
  const processIds = new Set<number>();
  const processes = metrics.filter((item) => {
    if (!Number.isInteger(item.pid) || item.pid <= 0 || processIds.has(item.pid)) return false;
    processIds.add(item.pid); return true;
  }).map((item) => {
    const roles = new Set(renderers.filter((renderer) => renderer.pid === item.pid).map((renderer) => renderer.kind));
    const kind: DesktopProcessKind = roles.size > 1 ? "shared" : roles.has("cache") ? "cache" : roles.has("window") ? "window" : item.type === "Browser" ? "browser" : item.type === "GPU" ? "gpu" : "other";
    const cpu = cpuReady && Number.isFinite(item.cpu.percentCPUUsage) && item.cpu.percentCPUUsage >= 0 ? item.cpu.percentCPUUsage : null;
    const memory = Number.isFinite(item.memory.workingSetSize) && item.memory.workingSetSize >= 0 ? item.memory.workingSetSize * 1024 : null;
    return { pid: item.pid, kind, cpu, memory };
  });
  return { processes, totalCpu: processes.length && processes.every((p) => p.cpu !== null) ? processes.reduce((sum, p) => sum + p.cpu!, 0) : null, totalMemory: processes.length && processes.every((p) => p.memory !== null) ? processes.reduce((sum, p) => sum + p.memory!, 0) : null, sampledAt, warmingUp: !cpuReady };
}
