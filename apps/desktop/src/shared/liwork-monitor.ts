/** The current LiWork bridge is configured for this Multica workspace. */
export const LIWORK_BRIDGE_WORKSPACE_ID = "978cd1d5-b5f0-4ad6-b52e-9f673a4d4c6a";

export interface LiworkSession {
  sessionId: string;
  issueId: string;
  identifier: string;
  title: string;
  state: "connected" | "unconfirmed";
  cpu: number | null;
  memory: number | null;
  privateMemory: number | null;
  pid: number | null;
  startedAt: number | null;
  lastOutputAt: number | null;
  agent: string | null;
  worktreeName: string | null;
  bridgeStatus: string;
}

export interface LiworkSnapshot {
  sessions: LiworkSession[];
  terminalsAvailable: boolean;
  metricsAvailable: boolean;
  sampledAt: number;
}
