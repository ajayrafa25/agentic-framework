import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import type { ChatMessage } from "@agentic/shared";
import { SERVER_PORT, WEB_ORIGIN, githubOAuthEnabled, llmEnabled } from "./config.js";
import { sessionStore } from "./session-store.js";
import { buildFileTree, readWorkspaceFile, writeWorkspaceFile } from "./files.js";
import { createAgentMessage, handleForgeRequest, shouldInvokeForge } from "./agent.js";
import { spawnTerminal } from "./terminal.js";
import { GithubConfigError, githubConfigured, githubRepoConfigured, openSessionPullRequest } from "./github.js";
import { GitError } from "./git.js";
import {
  bearerFromHeader,
  destroyAuthSession,
  exchangeGithubCode,
  githubAuthorizeUrl,
  githubTokenFor,
  loginRedirect,
  resolveRequestUser,
} from "./auth.js";
import { listCheckpoints } from "./checkpoints.js";
import { getTrainJob, startTrainJob, stopTrainJob } from "./train-job.js";

const app = express();
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json());

const oauthStates = new Set<string>();

function tokenFromReq(req: express.Request): string | undefined {
  return bearerFromHeader(req.headers.authorization) ?? (req.query.forge_token as string | undefined);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/config", (_req, res) => {
  res.json({
    githubOAuth: githubOAuthEnabled(),
    llm: llmEnabled(),
    githubRepo: githubRepoConfigured(),
    githubToken: githubConfigured(),
  });
});

app.get("/api/me", (req, res) => {
  res.json(resolveRequestUser(tokenFromReq(req)));
});

app.get("/auth/github", (_req, res) => {
  if (!githubOAuthEnabled()) {
    res.status(501).send("Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub login.");
    return;
  }
  const state = uuid();
  oauthStates.add(state);
  res.redirect(githubAuthorizeUrl(state));
});

app.get("/auth/github/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state || !oauthStates.has(state)) {
    res.status(400).send("Invalid OAuth callback");
    return;
  }
  oauthStates.delete(state);
  try {
    const session = await exchangeGithubCode(code);
    res.redirect(loginRedirect(session.token));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    res.status(500).send(message);
  }
});

app.post("/api/auth/logout", (req, res) => {
  destroyAuthSession(tokenFromReq(req));
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
  res.json({ ...session, trainJob: getTrainJob(req.params.id) });
});

app.post("/api/sessions", async (req, res) => {
  const user = resolveRequestUser(tokenFromReq(req));
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
    createdBy: createdBy ?? user.id,
    createdByName: user.name,
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
  const user = resolveRequestUser(tokenFromReq(req));
  const plan = sessionStore.updatePlan(req.params.id, req.body.content, req.body.updatedBy ?? user.id);
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

app.get("/api/sessions/:id/checkpoints", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(await listCheckpoints(session.workspacePath));
});

app.get("/api/sessions/:id/train", (req, res) => {
  if (!sessionStore.get(req.params.id)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(getTrainJob(req.params.id));
});

app.post("/api/sessions/:id/train", (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const status = startTrainJob(session.id, session.workspacePath, io, Boolean(req.body?.fast));
  const user = resolveRequestUser(tokenFromReq(req));
  sessionStore.addActivity({
    sessionId: session.id,
    sessionName: session.name,
    userId: user.id,
    userName: user.name,
    action: status.fast ? "Started a smoke training job" : "Started a training job",
  });
  res.json(status);
});

app.post("/api/sessions/:id/train/stop", (req, res) => {
  if (!sessionStore.get(req.params.id)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(stopTrainJob(req.params.id, io));
});

app.post("/api/sessions/:id/proposals/:proposalId/apply", async (req, res) => {
  const message = await sessionStore.applyProposal(req.params.id, req.params.proposalId);
  if (!message) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  const session = sessionStore.get(req.params.id);
  const user = resolveRequestUser(tokenFromReq(req));
  sessionStore.addActivity({
    sessionId: req.params.id,
    sessionName: session?.name ?? req.params.id,
    userId: user.id,
    userName: user.name,
    action: "Applied a Forge proposal",
  });
  io.to(`session:${req.params.id}`).emit("proposal:updated", message);
  res.json(message);
});

app.post("/api/sessions/:id/proposals/:proposalId/dismiss", (req, res) => {
  const message = sessionStore.dismissProposal(req.params.id, req.params.proposalId);
  if (!message) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  io.to(`session:${req.params.id}`).emit("proposal:updated", message);
  res.json(message);
});

app.get("/api/sessions/:id/git", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const status = await sessionStore.workspaceGitStatus(req.params.id);
  const userToken = githubTokenFor(tokenFromReq(req));
  res.json({
    ...status,
    githubPrUrl: session.githubPrUrl,
    githubConfigured: githubConfigured() || Boolean(userToken && githubRepoConfigured()),
  });
});

app.post("/api/sessions/:id/github-pr", async (req, res) => {
  const session = sessionStore.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const user = resolveRequestUser(tokenFromReq(req));
  try {
    const result = await openSessionPullRequest(
      session,
      session.workspacePath,
      githubTokenFor(tokenFromReq(req))
    );
    sessionStore.setGithubPrUrl(session.id, result.url);
    sessionStore.addActivity({
      sessionId: session.id,
      sessionName: session.name,
      userId: user.id,
      userName: user.name,
      action: result.created ? "Opened a GitHub pull request" : "Updated GitHub pull request",
    });
    res.json({ url: result.url, created: result.created });
  } catch (err) {
    if (err instanceof GithubConfigError) {
      res.status(501).json({ error: err.message });
      return;
    }
    const message = err instanceof GitError || err instanceof Error ? err.message : "Failed to open pull request";
    res.status(500).json({ error: message });
  }
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
  cors: { origin: WEB_ORIGIN, methods: ["GET", "POST"], credentials: true },
});

io.on("connection", (socket) => {
  let userName = resolveRequestUser(socket.handshake.auth?.token as string | undefined).name;

  socket.on("join", ({ sessionId, user }: { sessionId: string; user: { name: string } }) => {
    userName = user.name || userName;
    socket.join(`session:${sessionId}`);
    socket.emit("chat:history", sessionStore.getChat(sessionId));
    socket.emit("train:status", getTrainJob(sessionId));
  });

  socket.on("chat:send", async ({ sessionId, userId, content }: { sessionId: string; userId: string; content: string }) => {
    const user = resolveRequestUser(socket.handshake.auth?.token as string | undefined);
    const message: ChatMessage = {
      id: uuid(),
      sessionId,
      userId: userId || user.id,
      userName: userName || user.name,
      content,
      timestamp: new Date().toISOString(),
      type: "user",
    };

    sessionStore.addChat(message);
    io.to(`session:${sessionId}`).emit("chat:message", message);

    sessionStore.addActivity({
      sessionId,
      sessionName: sessionStore.get(sessionId)?.name ?? sessionId,
      userId: message.userId,
      userName: message.userName,
      action: `Commented in chat`,
    });

    if (shouldInvokeForge(content)) {
      const history = sessionStore.getChat(sessionId);
      const result = await handleForgeRequest(sessionId, content, history);
      const agentMsg = createAgentMessage(sessionId, result);
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
  await sessionStore.load();
  await sessionStore.seedDemoSessions();
  httpServer.listen(SERVER_PORT, () => {
    console.log(`Forge server listening on http://localhost:${SERVER_PORT}`);
  });
}

main();
