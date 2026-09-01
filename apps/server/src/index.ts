import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import type { ChatMessage } from "@agentic/shared";
import { SERVER_PORT, WEB_ORIGIN } from "./config.js";
import { sessionStore } from "./session-store.js";
import { buildFileTree, readWorkspaceFile, writeWorkspaceFile } from "./files.js";
import { createAgentMessage, handleForgeRequest, shouldInvokeForge } from "./agent.js";
import { spawnTerminal } from "./terminal.js";

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/sessions", (_req, res) => {
  res.json(sessionStore.list());
});

app.get("/api/sessions/:id", (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

app.post("/api/sessions", async (req, res) => {
  const { name, description, modelArchitecture, dataset, createdBy } = req.body;
  if (!name || !modelArchitecture || !dataset) {
    res.status(400).json({ error: "name, modelArchitecture, and dataset are required" });
    return;
  }
  const session = await sessionStore.create({
    name,
    description: description ?? "",
    modelArchitecture,
    dataset,
    createdBy: createdBy ?? "u1",
  });
  res.status(201).json(session);
});

app.get("/api/sessions/:id/chat", (req, res) => {
  res.json(sessionStore.getChat(req.params.id));
});

app.get("/api/sessions/:id/plan", (req, res) => {
  const plan = sessionStore.getPlan(req.params.id);
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(plan);
});

app.put("/api/sessions/:id/plan", (req, res) => {
  const plan = sessionStore.updatePlan(req.params.id, req.body.content, req.body.updatedBy ?? "u1");
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(plan);
});

app.get("/api/sessions/:id/files", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const tree = await buildFileTree(session.workspacePath);
  res.json(tree);
});

app.get("/api/sessions/:id/file", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  const filePath = req.query.path as string;
  if (!session || !filePath) {
    res.status(400).json({ error: "Session or path required" });
    return;
  }
  try {
    const content = await readWorkspaceFile(session.workspacePath, filePath);
    res.json({ path: filePath, content });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

app.put("/api/sessions/:id/file", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  const filePath = req.query.path as string;
  if (!session || !filePath) {
    res.status(400).json({ error: "Session or path required" });
    return;
  }
  await writeWorkspaceFile(session.workspacePath, filePath, req.body.content);
  res.json({ ok: true });
});

app.get("/api/activities", (_req, res) => {
  res.json(sessionStore.getActivities());
});

app.get("/api/dashboard", (_req, res) => {
  const sessions = sessionStore.list();
  const activities = sessionStore.getActivities().slice(0, 10);
  const inProgress = sessions.filter((s) => s.status === "training" || s.status === "planning");
  const recent = sessions.slice(0, 5);

  res.json({
    pickBackUp: inProgress,
    recentSessions: recent,
    teamPulse: activities,
    summary:
      inProgress.length > 0
        ? `You have ${inProgress.length} experiment(s) in progress. Review configs with your team before long training runs.`
        : "No active training runs. Start a new experiment or pick up a session from the list.",
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: WEB_ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  let joinedSessionId: string | null = null;
  let userName = "Anonymous";

  socket.on("join", ({ sessionId, user }: { sessionId: string; user: { name: string } }) => {
    joinedSessionId = sessionId;
    userName = user.name;
    socket.join(`session:${sessionId}`);
    socket.emit("chat:history", sessionStore.getChat(sessionId));
  });

  socket.on("chat:send", async ({ sessionId, userId, content }: { sessionId: string; userId: string; content: string }) => {
    const message: ChatMessage = {
      id: uuid(),
      sessionId,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
      type: "user",
    };

    sessionStore.addChat(message);
    io.to(`session:${sessionId}`).emit("chat:message", message);

    sessionStore.addActivity({
      sessionId,
      sessionName: sessionStore.get(sessionId)?.name ?? sessionId,
      userId,
      userName,
      action: `Commented in chat`,
    });

    if (shouldInvokeForge(content)) {
      const history = sessionStore.getChat(sessionId);
      const response = await handleForgeRequest(sessionId, content, history);
      const agentMsg = createAgentMessage(sessionId, response);
      sessionStore.addChat(agentMsg);
      io.to(`session:${sessionId}`).emit("chat:message", agentMsg);
    }
  });

  socket.on("terminal:start", ({ sessionId }: { sessionId: string }) => {
    const session = sessionStore.get(sessionId);
    if (!session) return;
    spawnTerminal(socket, sessionId, session.workspacePath);
    socket.emit("terminal:ready", { sessionId });
  });

  socket.on("plan:update", ({ sessionId, content, updatedBy }: { sessionId: string; content: string; updatedBy: string }) => {
    const plan = sessionStore.updatePlan(sessionId, content, updatedBy);
    if (plan) {
      io.to(`session:${sessionId}`).emit("plan:updated", plan);
    }
  });

  socket.on("metrics:watch", ({ sessionId }: { sessionId: string }) => {
    const interval = setInterval(() => {
      const session = sessionStore.get(sessionId);
      if (session?.metrics) {
        socket.emit("metrics:update", { sessionId, metrics: session.metrics });
      }
    }, 2000);

    socket.on("disconnect", () => clearInterval(interval));
  });
});

async function main() {
  await sessionStore.seedDemoSessions();
  httpServer.listen(SERVER_PORT, () => {
    console.log(`Forge server listening on http://localhost:${SERVER_PORT}`);
  });
}

main();
