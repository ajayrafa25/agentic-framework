#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { defaultHome, JobStore } from "./store.js";

const home = defaultHome();
const store = new JobStore(home);
const server = createServer(store);

const httpFlag = process.argv.indexOf("--http");
if (httpFlag !== -1) {
  const port = Number(process.argv[httpFlag + 1] ?? 8787);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("--http requires a port number");
  }
  const { startHttp } = await import("./http.js");
  await startHttp(() => createServer(store), port);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
