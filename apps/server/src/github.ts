import type { ExperimentSession } from "@agentic/shared";
import { WEB_ORIGIN } from "./config.js";
import { commitWorkspaceChanges, pushBranch } from "./git.js";

export class GithubConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubConfigError";
  }
}

function githubConfig() {
  const token = process.env.GITHUB_TOKEN || process.env.FORGE_GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || process.env.FORGE_GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO || process.env.FORGE_GITHUB_REPO;
  const base = process.env.GITHUB_BASE_BRANCH || process.env.FORGE_GITHUB_BASE || "main";
  return { token, owner, repo, base };
}

export function githubConfigured(): boolean {
  const { token, owner, repo } = githubConfig();
  return Boolean(token && owner && repo);
}

async function githubFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "forge-ml-collab",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  return { res, json };
}

export async function openSessionPullRequest(
  session: ExperimentSession,
  workspacePath: string
): Promise<{ url: string; created: boolean }> {
  const { token, owner, repo, base } = githubConfig();
  if (!token || !owner || !repo) {
    throw new GithubConfigError(
      "Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO to open a pull request."
    );
  }

  await commitWorkspaceChanges(workspacePath, `Forge: update ${session.name}`);

  const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  await pushBranch(workspacePath, remoteUrl, session.branch);

  const existing = await githubFetch(
    `/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${session.branch}`)}&state=open`,
    token
  );
  const existingList = existing.json as { html_url?: string }[];
  if (existing.res.ok && Array.isArray(existingList) && existingList[0]?.html_url) {
    return { url: existingList[0].html_url, created: false };
  }

  const sessionUrl = `${WEB_ORIGIN}/session/${session.id}`;
  const { res, json } = await githubFetch(`/repos/${owner}/${repo}/pulls`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `Experiment: ${session.name}`,
      head: session.branch,
      base,
      body: [
        `## Forge experiment`,
        ``,
        `- **Session:** [${session.name}](${sessionUrl})`,
        `- **Architecture:** \`${session.modelArchitecture}\``,
        `- **Dataset:** \`${session.dataset}\``,
        `- **Branch:** \`${session.branch}\``,
        ``,
        session.description ? `${session.description}\n` : "",
        `Opened from Forge so the team can review training code and config together.`,
      ].join("\n"),
    }),
  });

  const payload = json as { html_url?: string; message?: string; errors?: { message?: string }[] };
  if (!res.ok || !payload.html_url) {
    const detail = payload.errors?.map((e) => e.message).filter(Boolean).join("; ") || payload.message;
    throw new Error(detail || `GitHub API error (${res.status})`);
  }

  return { url: payload.html_url, created: true };
}
