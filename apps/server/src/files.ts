import fs from "fs-extra";
import path from "node:path";
import type { FileNode } from "@agentic/shared";

export async function buildFileTree(root: string, relative = ""): Promise<FileNode[]> {
  const current = path.join(root, relative);
  if (!fs.existsSync(current)) return [];

  const entries = await fs.readdir(current);
  const nodes: FileNode[] = [];

  for (const name of entries.sort()) {
    if (name === ".git" || name === "__pycache__" || name === ".venv") continue;
    const relPath = relative ? `${relative}/${name}` : name;
    const fullPath = path.join(root, relPath);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      nodes.push({
        name,
        path: relPath,
        type: "directory",
        children: await buildFileTree(root, relPath),
      });
    } else {
      nodes.push({ name, path: relPath, type: "file" });
    }
  }

  return nodes;
}

export async function readWorkspaceFile(workspacePath: string, relPath: string): Promise<string> {
  const full = path.join(workspacePath, relPath);
  if (!full.startsWith(workspacePath)) throw new Error("Invalid path");
  return fs.readFile(full, "utf-8");
}

export async function writeWorkspaceFile(
  workspacePath: string,
  relPath: string,
  content: string
): Promise<void> {
  const full = path.join(workspacePath, relPath);
  if (!full.startsWith(workspacePath)) throw new Error("Invalid path");
  await fs.writeFile(full, content, "utf-8");
}
