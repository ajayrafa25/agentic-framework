import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

/**
 * Local Streamable HTTP endpoint for clients that cannot spawn a stdio process.
 * Bind is localhost only. Put a tunnel in front if a hosted chatbot needs a public URL.
 */
export async function startHttp(create: () => McpServer, port: number): Promise<void> {
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    const existing = sessionId ? transports.get(sessionId) : undefined;

    if (existing) {
      await existing.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Expected an initialize request" },
        id: null,
      });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) transports.delete(id);
    };
    const server = create();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const sessionHandler = async (req: Request, res: Response) => {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Missing or unknown mcp-session-id");
      return;
    }
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", sessionHandler);
  app.delete("/mcp", sessionHandler);

  await new Promise<void>((resolve) => {
    app.listen(port, "127.0.0.1", () => {
      process.stderr.write(`naukri-mcp listening on http://127.0.0.1:${port}/mcp\n`);
      resolve();
    });
  });
}
