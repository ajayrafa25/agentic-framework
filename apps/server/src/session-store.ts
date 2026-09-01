import fs from "fs-extra";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type { ActivityItem, ChatMessage, ExperimentSession, PlanDocument, TrainingMetrics } from "@agentic/shared";
import { TEMPLATE_DIR, WORKSPACES_DIR } from "./config.js";

const sessions = new Map<string, ExperimentSession>();
const chatHistory = new Map<string, ChatMessage[]>();
const plans = new Map<string, PlanDocument>();
const activities: ActivityItem[] = [];

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

export class SessionStore {
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
  }): Promise<ExperimentSession> {
    const id = uuid();
    const branch = `experiment/${id.slice(0, 8)}`;
    const workspacePath = path.join(WORKSPACES_DIR, id);
    await fs.ensureDir(WORKSPACES_DIR);
    await fs.copy(TEMPLATE_DIR, workspacePath);

    const configPath = path.join(workspacePath, "config/experiment.yaml");
    let configText = await fs.readFile(configPath, "utf-8");
    configText = configText
      .replace(/\{\{name\}\}/g, input.name)
      .replace(/architecture: resnet50/, `architecture: ${input.modelArchitecture}`)
      .replace(/dataset: cifar10/, `dataset: ${input.dataset}`);
    await fs.writeFile(configPath, configText);

    const readmePath = path.join(workspacePath, "README.md");
    let readme = await fs.readFile(readmePath, "utf-8");
    readme = readme.replace(/\{\{name\}\}/g, input.name);
    await fs.writeFile(readmePath, readme);

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
      userName: input.createdBy,
      action: "Created experiment session",
    });

    return session;
  }

  updateStatus(id: string, status: ExperimentSession["status"]): ExperimentSession | undefined {
    const session = sessions.get(id);
    if (!session) return undefined;
    session.status = status;
    session.updatedAt = new Date().toISOString();
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
    return item;
  }

  getActivities(): ActivityItem[] {
    return activities;
  }

  async seedDemoSessions(): Promise<void> {
    if (sessions.size > 0) return;

    const baseline = await this.create({
      name: "resnet50-cifar10-baseline",
      description: "Baseline image classifier — team is tuning learning rate and augmentation",
      modelArchitecture: "resnet50",
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
