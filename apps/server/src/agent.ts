import { v4 as uuid } from "uuid";
import {
  AGENT_NAME,
  AGENT_USER_ID,
  type ChatMessage,
} from "@agentic/shared";
import { sessionStore } from "./session-store.js";
import { readWorkspaceFile, writeWorkspaceFile } from "./files.js";
import { commitWorkspaceChanges } from "./git.js";

const FORGE_MENTION = /@forge/i;

function extractLearningRate(text: string): number | null {
  const match = text.match(/(?:lr|learning rate)\s*(?:to|=|:)?\s*([\d.]+e?-?\d*)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractEpochs(text: string): number | null {
  const match = text.match(/(\d+)\s*epochs?/i);
  return match ? parseInt(match[1], 10) : null;
}

async function updateConfigField(
  workspacePath: string,
  field: "learning_rate" | "epochs",
  value: number
): Promise<string> {
  const configPath = "config/experiment.yaml";
  let content = await readWorkspaceFile(workspacePath, configPath);

  if (field === "learning_rate") {
    content = content.replace(
      /learning_rate:\s*[\d.]+/,
      `learning_rate: ${value}`
    );
  } else {
    content = content.replace(/epochs:\s*\d+/, `epochs: ${value}`);
  }

  await writeWorkspaceFile(workspacePath, configPath, content);
  return configPath;
}

export async function handleForgeRequest(
  sessionId: string,
  triggerMessage: string,
  recentChat: ChatMessage[]
): Promise<string> {
  const session = sessionStore.get(sessionId);
  if (!session) return "I couldn't find this experiment session.";

  const chatContext = recentChat
    .slice(-12)
    .map((m) => `${m.userName}: ${m.content}`)
    .join("\n");

  const lower = triggerMessage.toLowerCase();
  const actions: string[] = [];

  if (
    lower.includes("learning rate") ||
    lower.includes("lr") ||
    extractLearningRate(triggerMessage) !== null
  ) {
    const lr = extractLearningRate(triggerMessage) ?? extractLearningRate(chatContext);
    if (lr !== null) {
      const file = await updateConfigField(session.workspacePath, "learning_rate", lr);
      actions.push(`Updated learning rate to ${lr} in ${file}`);
    }
  }

  if (lower.includes("epoch") || extractEpochs(triggerMessage) !== null) {
    const epochs = extractEpochs(triggerMessage) ?? extractEpochs(chatContext);
    if (epochs !== null) {
      const file = await updateConfigField(session.workspacePath, "epochs", epochs);
      actions.push(`Updated epochs to ${epochs} in ${file}`);
    }
  }

  if (lower.includes("augmentation") || lower.includes("augment")) {
    const configPath = "config/experiment.yaml";
    let content = await readWorkspaceFile(session.workspacePath, configPath);
    if (lower.includes("disable") || lower.includes("turn off")) {
      content = content.replace(/random_flip:\s*true/, "random_flip: false");
      actions.push("Disabled random_flip augmentation");
    } else {
      content = content.replace(/random_flip:\s*false/, "random_flip: true");
      actions.push("Enabled random_flip augmentation");
    }
    await writeWorkspaceFile(session.workspacePath, configPath, content);
  }

  if (lower.includes("train") && !lower.includes("training rate")) {
    actions.push(
      "Ready to train. Run `python scripts/validate_config.py` then `python scripts/train.py` in the terminal."
    );
    sessionStore.updateStatus(sessionId, "training");
  }

  if (lower.includes("evaluate") || lower.includes("eval")) {
    actions.push("Run `python scripts/evaluate.py` to evaluate the latest checkpoint.");
    sessionStore.updateStatus(sessionId, "evaluating");
  }

  if (lower.includes("plan")) {
    const plan = sessionStore.getPlan(sessionId);
    if (plan) {
      return `Here's the current experiment plan. Review it with your team before training:\n\n${plan.content.slice(0, 500)}...`;
    }
  }

  if (actions.length > 0) {
    try {
      await commitWorkspaceChanges(session.workspacePath, `forge: ${actions[0]}`);
    } catch {
      // workspace may not be a git repo yet
    }
    return `Done. ${actions.join(" · ")} Review the config diff and discuss in chat before starting a long training run.`;
  }

  return `I've read the team discussion (${recentChat.length} messages in context). For ML experiments, try:\n• "@forge set learning rate to 3e-4"\n• "@forge run 30 epochs"\n• "@forge disable augmentation"\n• "@forge start training"\n\nI'll apply config changes based on team chat context.`;
}

export function createAgentMessage(sessionId: string, content: string): ChatMessage {
  return {
    id: uuid(),
    sessionId,
    userId: AGENT_USER_ID,
    userName: AGENT_NAME,
    content,
    timestamp: new Date().toISOString(),
    type: "agent",
  };
}

export function shouldInvokeForge(content: string): boolean {
  return FORGE_MENTION.test(content);
}
