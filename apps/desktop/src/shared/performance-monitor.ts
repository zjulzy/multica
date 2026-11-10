export type DesktopProcessKind = "browser" | "window" | "cache" | "shared" | "gpu" | "other";
export interface DesktopProcessSample { pid: number; kind: DesktopProcessKind; cpu: number | null; memory: number | null }
export interface DesktopPerformanceSnapshot { processes: DesktopProcessSample[]; totalCpu: number | null; totalMemory: number | null; sampledAt: number; warmingUp: boolean }
export function performanceRefreshInterval(snapshot: DesktopPerformanceSnapshot | undefined): number { return snapshot?.warmingUp ? 1000 : 10000; }
