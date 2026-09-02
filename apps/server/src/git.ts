import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_IDENTITY = {
  GIT_AUTHOR_NAME: "Forge",
  GIT_AUTHOR_EMAIL: "forge@localhost",
  GIT_COMMITTER_NAME: "Forge",
  GIT_COMMITTER_EMAIL: "forge@localhost",
};

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitError";
  }
}

export async function git(cwd: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      env: { ...process.env, ...GIT_IDENTITY, ...extraEnv },
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new GitError(e.stderr?.trim() || e.message || "git command failed");
  }
}

export async function initWorkspaceRepo(workspacePath: string, branch: string): Promise<void> {
  await git(workspacePath, ["init", "-b", branch]);
  await git(workspacePath, ["add", "-A"]);
  try {
    await git(workspacePath, ["commit", "-m", "Initial experiment workspace"]);
  } catch {
    // empty commit should not happen; ignore if git refuses
  }
}

export async function commitWorkspaceChanges(workspacePath: string, message: string): Promise<boolean> {
  await git(workspacePath, ["add", "-A"]);
  const status = await git(workspacePath, ["status", "--porcelain"]);
  if (!status) return false;
  await git(workspacePath, ["commit", "-m", message]);
  return true;
}

export async function gitStatus(workspacePath: string): Promise<{ branch: string; dirty: boolean; lastCommit?: string }> {
  const branch = await git(workspacePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const porcelain = await git(workspacePath, ["status", "--porcelain"]);
  let lastCommit: string | undefined;
  try {
    lastCommit = await git(workspacePath, ["log", "-1", "--pretty=%s"]);
  } catch {
    lastCommit = undefined;
  }
  return { branch, dirty: porcelain.length > 0, lastCommit };
}

export async function pushBranch(
  workspacePath: string,
  remoteUrl: string,
  branch: string
): Promise<void> {
  await git(workspacePath, ["push", "-u", remoteUrl, `HEAD:refs/heads/${branch}`]);
}
