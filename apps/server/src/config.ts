import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, "../../../");
export const WORKSPACES_DIR = path.join(ROOT_DIR, "workspaces");
export const TEMPLATE_DIR = path.join(ROOT_DIR, "templates/ml-experiment");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const STATE_PATH = path.join(DATA_DIR, "forge-state.json");
export const SERVER_PORT = Number(process.env.SERVER_PORT ?? 3001);
export const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
export const GITHUB_OAUTH_CALLBACK =
  process.env.GITHUB_OAUTH_CALLBACK ?? `http://localhost:${SERVER_PORT}/auth/github/callback`;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
export const PYTHON_BIN = process.env.PYTHON ?? process.env.PYTHON_BIN ?? "python3";

export function githubOAuthEnabled(): boolean {
  return Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);
}

export function llmEnabled(): boolean {
  return Boolean(OPENAI_API_KEY || ANTHROPIC_API_KEY);
}
