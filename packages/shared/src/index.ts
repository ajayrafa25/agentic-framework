export type UserId = string;

export interface User {
  id: UserId;
  name: string;
  role: "ml-engineer" | "researcher" | "pm" | "data-scientist";
  color: string;
}

export interface ExperimentSession {
  id: string;
  name: string;
  description: string;
  modelArchitecture: string;
  dataset: string;
  status: "planning" | "training" | "evaluating" | "ready" | "merged";
  branch: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  createdBy: UserId;
  metrics?: TrainingMetrics;
}

export interface TrainingMetrics {
  epoch: number;
  totalEpochs: number;
  trainLoss: number;
  valLoss: number;
  primaryMetric: number;
  primaryMetricName: string;
  learningRate: number;
  status: "idle" | "running" | "completed" | "failed";
  lastUpdated: string;
  history: MetricPoint[];
}

export interface MetricPoint {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  primaryMetric: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: UserId;
  userName: string;
  content: string;
  timestamp: string;
  type: "user" | "agent" | "system";
}

export interface PlanDocument {
  sessionId: string;
  title: string;
  content: string;
  updatedAt: string;
  updatedBy: UserId;
}

export interface ActivityItem {
  id: string;
  sessionId: string;
  sessionName: string;
  userId: UserId;
  userName: string;
  action: string;
  timestamp: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface SessionSummary {
  sessionId: string;
  summary: string;
  recentChanges: string[];
}

export const DEMO_USERS: User[] = [
  { id: "u1", name: "Maggie", role: "ml-engineer", color: "#a78bfa" },
  { id: "u2", name: "Nate", role: "researcher", color: "#34d399" },
  { id: "u3", name: "David", role: "ml-engineer", color: "#60a5fa" },
];

export const AGENT_USER_ID = "forge-agent";
export const AGENT_NAME = "Forge";
