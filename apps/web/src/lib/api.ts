import type { ExperimentSession } from "@agentic/shared";
import { API_URL } from "./config";

export async function fetchSessions(): Promise<ExperimentSession[]> {
  const res = await fetch(`${API_URL}/api/sessions`);
  return res.json();
}

export async function fetchSession(id: string): Promise<ExperimentSession> {
  const res = await fetch(`${API_URL}/api/sessions/${id}`);
  return res.json();
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function fetchDashboard() {
  const res = await fetch(`${API_URL}/api/dashboard`);
  return res.json();
}

export async function fetchFile(sessionId: string, path: string) {
  const res = await fetch(
    `${API_URL}/api/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`
  );
  return res.json();
}

export async function saveFile(sessionId: string, path: string, content: string) {
  await fetch(`${API_URL}/api/sessions/${sessionId}/file?path=${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function fetchPlan(sessionId: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/plan`);
  return res.json();
}

export async function savePlan(sessionId: string, content: string, updatedBy: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/plan`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, updatedBy }),
  });
  return res.json();
}

export async function fetchGitStatus(sessionId: string) {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/git`);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "u1", userName: "Maggie" }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to open pull request");
  }
  return data as { url: string; created: boolean };
}
