import fs from "fs-extra";
import path from "node:path";
import { v4 as uuid } from "uuid";
import {
  DEMO_USERS,
  type ActivityItem,
  type ChatMessage,
  type ExperimentSession,
  type PlanDocument,
  type TrainingMetrics,
} from "@agentic/shared";
import { STATE_PATH, TEMPLATE_DIR, WORKSPACES_DIR } from "./config.js";
import { writeWorkspaceFile } from "./files.js";
import { GitError, commitWorkspaceChanges, gitStatus, initWorkspaceRepo } from "./git.js";

function displayName(userId: string): string {
  return DEMO_USERS.find((u) => u.id === userId)?.name ?? userId;
}

interface PersistedState {
  version: 1;
  sessions: ExperimentSession[];
  chats: Record<string, ChatMessage[]>;
  plans: Record<string, PlanDocument>;
  activities: ActivityItem[];
}

const sessions = new Map<string, ExperimentSession>();
const chatHistory = new Map<string, ChatMessage[]>();
const plans = new Map<string, PlanDocument>();
let activities: ActivityItem[] = [];

function metricsFromFile(workspacePath: string): TrainingMetrics | undefined {
  const metricsPath = path.join(workspacePath, "experiments/logs/metrics.json");
  if (!fs.existsSync(metricsPath)) return undefined;
  try {
    const raw = fs.readJsonSync(metricsPath) as TrainingMetrics;
    return raw;
  } catch {
    return undefined;
  }
}

function defaultPlan(name: string): string {
  return `# Experiment plan: ${name}

## Objective
Define what we're trying to improve and how we'll measure success.

## Hypothesis
- 

## Model & data
- Architecture:
- Dataset:
- Baseline metric:

## Training changes
- Hyperparameters to tune:
- Expected runtime / compute budget:

## Risks & open questions
- 

## Sign-off
Discuss in chat before @forge implements changes.
`;
}

function snapshot(): PersistedState {
  return {
    version: 1,
    sessions: Array.from(sessions.values()).map(({ metrics: _metrics, ...rest }) => rest),
    chats: Object.fromEntries(chatHistory.entries()),
    plans: Object.fromEntries(plans.entries()),
    activities,
  };
}

function persist(): void {
  fs.ensureDirSync(path.dirname(STATE_PATH));
  fs.writeJsonSync(STATE_PATH, snapshot(), { spaces: 2 });
}

export class SessionStore {
  async load(): Promise<void> {
    if (!(await fs.pathExists(STATE_PATH))) return;
    try {
      const data = (await fs.readJson(STATE_PATH)) as PersistedState;
      sessions.clear();
      chatHistory.clear();
      plans.clear();
      for (const session of data.sessions ?? []) {
        session.workspacePath = path.join(WORKSPACES_DIR, session.id);
        sessions.set(session.id, session);
        const gitDir = path.join(session.workspacePath, ".git");
        if ((await fs.pathExists(session.workspacePath)) && !(await fs.pathExists(gitDir))) {
          try {
            await initWorkspaceRepo(session.workspacePath, session.branch);
          } catch (err) {
            const message = err instanceof GitError ? err.message : String(err);
            console.warn(`git init failed for ${session.id}:`, message);
          }
        }
      }
      for (const [id, messages] of Object.entries(data.chats ?? {})) {
        chatHistory.set(id, messages);
      }
      for (const [id, plan] of Object.entries(data.plans ?? {})) {
        plans.set(id, plan);
      }
      activities = data.activities ?? [];
    } catch (err) {
      console.warn("Failed to load persisted sessions:", err);
    }
  }

  list(): ExperimentSession[] {
    return Array.from(sessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  get(id: string): ExperimentSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;
    session.metrics = metricsFromFile(session.workspacePath);
    return session;
  }

  async create(input: {
    name: string;
    description: string;
    modelArchitecture: string;
    dataset: string;
    createdBy: string;
    createdByName?: string;
  }): Promise<ExperimentSession> {
    const id = uuid();
    const branch = `experiment/${id.slice(0, 8)}`;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    await fs.ensureDir(WORKSPACES_DIR);
    await fs.copy(TEMPLATE_DIR, workspacePath, {
      filter: (src) => {
        const rel = path.relative(TEMPLATE_DIR, src);
        if (!rel || rel === ".") return true;
        if (rel === "experiments" || rel.startsWith(`experiments${path.sep}`)) return false;
        if (rel.startsWith(`data${path.sep}cifar`)) return false;
        if (rel === ".git" || rel.startsWith(`.git${path.sep}`)) return false;
        return true;
      },
    });
    await fs.ensureDir(path.join(workspacePath, "experiments/logs"));
    await fs.ensureDir(path.join(workspacePath, "experiments/checkpoints"));

    const configPath = path.join(workspacePath, "config/experiment.yaml");
    let configText = await fs.readFile(configPath, "utf-8");
    configText = configText
      .replace(/\{\{name\}\}/g, input.name)
      .replace(/^(\s*architecture:\s*).+$/m, `$1${input.modelArchitecture}`)
      .replace(/^(\s*dataset:\s*).+$/m, `$1${input.dataset}`);
    await fs.writeFile(configPath, configText);

    const readmePath = path.join(workspacePath, "README.md");
    let readme = await fs.readFile(readmePath, "utf-8");
    readme = readme.replace(/\{\{name\}\}/g, input.name);
    await fs.writeFile(readmePath, readme);

    try {
      await initWorkspaceRepo(workspacePath, branch);
    } catch (err) {
      const message = err instanceof GitError ? err.message : String(err);
      console.warn(`git init failed for ${id}:`, message);
    }

    const now = new Date().toISOString();
    const session: ExperimentSession = {
      id,
      name: input.name,
      description: input.description,
      modelArchitecture: input.modelArchitecture,
      dataset: input.dataset,
      status: "planning",
      branch,
      workspacePath,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };

    sessions.set(id, session);
    chatHistory.set(id, []);
    plans.set(id, {
      sessionId: id,
      title: `Plan: ${input.name}`,
      content: defaultPlan(input.name),
      updatedAt: now,
      updatedBy: input.createdBy,
    });

    this.addActivity({
      sessionId: id,
      sessionName: input.name,
      userId: input.createdBy,
      userName: input.createdByName ?? displayName(input.createdBy),
      action: "Created experiment session",
    });

    persist();
    return session;
  }

  updateStatus(id: string, status: ExperimentSession["status"]): ExperimentSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;
    session.status = status;
    session.updatedAt = new Date().toISOString();
    persist();
    return session;
  }

  setGithubPrUrl(id: string, url: string): ExperimentSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;
    session.githubPrUrl = url;
    session.updatedAt = new Date().toISOString();
    persist();
    return session;
  }

  getChat(sessionId: string): ChatMessage[] {
    return chatHistory.get(sessionId) ?? [];
  }

  addChat(message: ChatMessage): ChatMessage {
    const list = chatHistory.get(message.sessionId) ?? [];
    list.push(message);
    chatHistory.set(message.sessionId, list);
    const session = sessions.get(message.sessionId);
    if (session) session.updatedAt = new Date().toISOString();
    persist();
    return message;
  }

  findProposal(sessionId: string, proposalId: string): ChatMessage | undefined {
    return this.getChat(sessionId).find((m) => m.proposal?.id === proposalId);
  }

  async applyProposal(sessionId: string, proposalId: string): Promise<ChatMessage | undefined> {
    const message = this.findProposal(sessionId, proposalId);
    const proposal = message?.proposal;
    const session = sessions.get(sessionId);
    if (!message || !proposal || !session) return undefined;
    if (proposal.status !== "pending") return message;
    for (const file of proposal.files) {
      if (file.path.includes("..") || file.path.startsWith("/")) continue;
      await writeWorkspaceFile(session.workspacePath, file.path, file.after);
    }
    try {
      await commitWorkspaceChanges(session.workspacePath, `forge: ${proposal.summary}`);
    } catch {
      // workspace may not be a git repo yet
    }
    proposal.status = "applied";
    session.updatedAt = new Date().toISOString();
    persist();
    return message;
  }

  dismissProposal(sessionId: string, proposalId: string): ChatMessage | undefined {
    const message = this.findProposal(sessionId, proposalId);
    if (!message?.proposal) return undefined;
    if (message.proposal.status !== "pending") return message;
    message.proposal.status = "dismissed";
    persist();
    return message;
  }

  getPlan(sessionId: string): PlanDocument | undefined {
    return plans.get(sessionId);
  }

  updatePlan(sessionId: string, content: string, updatedBy: string): PlanDocument | undefined {
    const plan = plans.get(sessionId);
    if (!plan) return undefined;
    plan.content = content;
    plan.updatedAt = new Date().toISOString();
    plan.updatedBy = updatedBy;
    const session = sessions.get(sessionId);
    if (session) session.updatedAt = new Date().toISOString();
    persist();
    return plan;
  }

  addActivity(input: Omit<ActivityItem, "id" | "timestamp">): ActivityItem {
    const item: ActivityItem = {
      ...input,
      id: uuid(),
      timestamp: new Date().toISOString(),
    };
    activities.unshift(item);
    if (activities.length > 100) activities.length = 100;
    persist();
    return item;
  }

  getActivities(): ActivityItem[] {
    return activities;
  }

  async workspaceGitStatus(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) return undefined;
    try {
      return await gitStatus(session.workspacePath);
    } catch {
      return { branch: session.branch, dirty: false };
    }
  }

  async seedDemoSessions(): Promise<void> {
    if (sessions.size > 0) return;

    const baseline = await this.create({
      name: "resnet18-cifar10-baseline",
      description: "Baseline image classifier — team is tuning learning rate and augmentation",
      modelArchitecture: "resnet18",
      dataset: "cifar10",
      createdBy: "u1",
    });

    const finetune = await this.create({
      name: "vit-b16-finetune",
      description: "Fine-tuning vision transformer on custom dataset",
      modelArchitecture: "vit-b16",
      dataset: "custom-vision",
      createdBy: "u2",
    });

    this.addChat({
      id: uuid(),
      sessionId: baseline.id,
      userId: "u2",
      userName: "Nate",
      content: "Should we drop LR to 3e-4 before the next run? Val loss plateaued last epoch.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: "user",
    });

    this.addChat({
      id: uuid(),
      sessionId: finetune.id,
      userId: "u3",
      userName: "David",
      content: "Dataset manifest updated — ready to resume training after config review.",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      type: "user",
    });
  }
}

export const sessionStore = new SessionStore();
