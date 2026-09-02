import { v4 as uuid } from "uuid";
import type { AuthUser } from "@agentic/shared";
import { DEMO_USERS } from "@agentic/shared";
import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_OAUTH_CALLBACK,
  WEB_ORIGIN,
  githubOAuthEnabled,
} from "./config.js";

interface ForgeAuthSession {
  token: string;
  user: AuthUser;
  githubAccessToken?: string;
  createdAt: number;
}

const sessions = new Map<string, ForgeAuthSession>();

export const DEMO_AUTH_USER: AuthUser = {
  id: DEMO_USERS[0].id,
  name: DEMO_USERS[0].name,
  source: "demo",
};

export function githubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_OAUTH_CALLBACK,
    scope: "read:user user:email public_repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGithubCode(code: string): Promise<ForgeAuthSession> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_OAUTH_CALLBACK,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    throw new Error(tokenJson.error || "GitHub token exchange failed");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "forge-ml-collab",
    },
  });
  const gh = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
  };
  if (!gh.login) throw new Error("Could not load GitHub profile");

  const user: AuthUser = {
    id: `gh:${gh.id}`,
    name: gh.name?.trim() || gh.login,
    login: gh.login,
    avatarUrl: gh.avatar_url,
    source: "github",
  };
  const token = uuid();
  const session: ForgeAuthSession = {
    token,
    user,
    githubAccessToken: tokenJson.access_token,
    createdAt: Date.now(),
  };
  sessions.set(token, session);
  return session;
}

export function getAuthSession(token: string | undefined): ForgeAuthSession | undefined {
  if (!token) return undefined;
  return sessions.get(token);
}

export function resolveRequestUser(token: string | undefined): AuthUser {
  return getAuthSession(token)?.user ?? DEMO_AUTH_USER;
}

export function githubTokenFor(token: string | undefined): string | undefined {
  return getAuthSession(token)?.githubAccessToken;
}

export function destroyAuthSession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function bearerFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function loginRedirect(token: string): string {
  const url = new URL(WEB_ORIGIN);
  url.searchParams.set("forge_token", token);
  return url.toString();
}

export { githubOAuthEnabled };
