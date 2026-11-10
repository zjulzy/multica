import { describe, expect, it } from "vitest";
import { buildPerformanceSnapshot } from "./performance-monitor";
import { performanceRefreshInterval } from "../shared/performance-monitor";

describe("desktop performance snapshot", () => {
  it("deduplicates processes, converts KiB to bytes, and identifies shared renderers", () => {
    const metrics = [
      { pid: 10, type: "Browser", cpu: { percentCPUUsage: 2 }, memory: { workingSetSize: 100 } },
      { pid: 20, type: "Tab", cpu: { percentCPUUsage: 3 }, memory: { workingSetSize: 200 } },
      { pid: 20, type: "Tab", cpu: { percentCPUUsage: 3 }, memory: { workingSetSize: 200 } },
    ];
    const result = buildPerformanceSnapshot(metrics, [{ pid: 20, kind: "window" }, { pid: 20, kind: "cache" }], true, 123);
    expect(result.processes).toHaveLength(2);
    expect(result.totalMemory).toBe(300 * 1024);
    expect(result.totalCpu).toBe(5);
    expect(result.processes[1]?.kind).toBe("shared");
    expect(result.sampledAt).toBe(123);
  });
  it("does not present the first CPU sample as a measured zero", () => {
    const result = buildPerformanceSnapshot([{ pid: 1, type: "Browser", cpu: { percentCPUUsage: 0 }, memory: { workingSetSize: 10 } }], [], false, 1);
    expect(result.totalCpu).toBeNull();
    expect(result.processes[0]?.cpu).toBeNull();
    expect(result.warmingUp).toBe(true);
    expect(performanceRefreshInterval(result)).toBe(1000);
    expect(performanceRefreshInterval({ ...result, warmingUp: false })).toBe(10000);
  });
});
