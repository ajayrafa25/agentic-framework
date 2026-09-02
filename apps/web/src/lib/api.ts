import type { AuthUser, ChatMessage, CheckpointInfo, ExperimentSession, TrainJobStatus } from "@agentic/shared";
import { API_URL } from "./config";

const TOKEN_KEY = "forge_token";

export function getForgeToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setForgeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function headers(extra?: HeadersInit): HeadersInit {
  const token = getForgeToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export async function fetchAuthConfig() {
  const res = await fetch(`${API_URL}/api/auth/config`);
  return parseJson<{ githubOAuth: boolean; llm: boolean; githubRepo: boolean; githubToken: boolean }>(res);
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/me`, { headers: headers() });
  return parseJson<AuthUser>(res);
}

export function githubLoginUrl() {
  return `${API_URL}/auth/github`;
}

export async function logout() {
  await fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: headers() });
  setForgeToken(null);
}

export async function fetchSessions(): Promise<ExperimentSession[]> {
  const res = await fetch(`${API_URL}/api/sessions`, { headers: headers() });
  return parseJson(res);
}

export async function fetchSession(id: string): Promise<ExperimentSession & { trainJob?: TrainJobStatus }> {
  const res = await fetch(`${API_URL}/api/sessions/${id}`, { headers: headers() });
  return parseJson(res);
}

export async function createSession(input: {
  name: string;
  description: string;
  modelArchitecture: string;
  dataset: string;
  createdBy: string;
}): Promise<ExperimentSession> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function fetchDashboard() {
  const res = await fetch(`${API_URL}/api/dashboard`, { headers: headers() });
  return res.json();
}

export async function fetchFile(sessionId: string, path: string) {
  const res = await fetch(
    `${API_URL}/api/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`,
    { headers: headers() }
  );
  return res.json();
}

export async function saveFile(sessionId: string, path: string, content: string) {
  await fetch(`${API_URL}/api/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content }),
  });
}

export async function fetchPlan(sessionId: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/plan`, { headers: headers() });
  return res.json();
}

export async function savePlan(sessionId: string, content: string, updatedBy: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/plan`, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content, updatedBy }),
  });
  return res.json();
}

export async function fetchGitStatus(sessionId: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/git`, { headers: headers() });
  return res.json() as Promise<{
    branch?: string;
    dirty?: boolean;
    lastCommit?: string;
    githubPrUrl?: string;
    githubConfigured?: boolean;
  }>;
}

export async function openPullRequest(sessionId: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/github-pr`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to open pull request");
  }
  return data as { url: string; created: boolean };
}

export async function applyProposal(sessionId: string, proposalId: string): Promise<ChatMessage> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/proposals/${proposalId}/apply`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to apply proposal");
  return parseJson(res);
}

export async function dismissProposal(sessionId: string, proposalId: string): Promise<ChatMessage> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/proposals/${proposalId}/dismiss`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to dismiss proposal");
  return parseJson(res);
}

export async function fetchCheckpoints(sessionId: string): Promise<CheckpointInfo[]> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/checkpoints`, { headers: headers() });
  return parseJson(res);
}

export async function startTraining(sessionId: string, fast = false): Promise<TrainJobStatus> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/train`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ fast }),
  });
  return parseJson(res);
}

export async function stopTraining(sessionId: string): Promise<TrainJobStatus> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/train/stop`, {
    method: "POST",
    headers: headers(),
  });
  return parseJson(res);
}
