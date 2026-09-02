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
