import fs from "fs-extra";
import path from "node:path";
import type { CheckpointInfo } from "@agentic/shared";

export async function listCheckpoints(workspacePath: string): Promise<CheckpointInfo[]> {
  const dir = path.join(workspacePath, "experiments/checkpoints");
  if (!(await fs.pathExists(dir))) return [];
  const names = await fs.readdir(dir);
  const items: CheckpointInfo[] = [];
  for (const name of names.sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const stat = await fs.stat(full);
    if (!stat.isFile()) continue;
    items.push({
      name,
      path: `experiments/checkpoints/${name}`,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    });
  }
  return items.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}
