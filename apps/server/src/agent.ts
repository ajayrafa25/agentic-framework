import { v4 as uuid } from "uuid";
import {
  AGENT_NAME,
  AGENT_USER_ID,
  type ChatMessage,
  type ForgeProposal,
} from "@agentic/shared";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  llmEnabled,
} from "./config.js";
import { sessionStore } from "./session-store.js";
import { readWorkspaceFile } from "./files.js";

const FORGE_MENTION = /@forge/i;
const CONFIG_PATH = "config/experiment.yaml";

export interface ForgeResult {
  content: string;
  proposal?: ForgeProposal;
}

function extractLearningRate(text: string): number | null {
  const match = text.match(/(?:lr|learning rate)\s*(?:to|=|:)?\s*([\d.]+e?-?\d*)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractEpochs(text: string): number | null {
  const match = text.match(/(\d+)\s*epochs?/i);
  return match ? parseInt(match[1], 10) : null;
}

function setYamlScalar(content: string, key: string, value: string): string {
  const re = new RegExp(`^(\\s*${key}:\\s*).+$`, "m");
  if (!re.test(content)) return content;
  return content.replace(re, `$1${value}`);
}

function proposalFromFiles(
  summary: string,
  files: { path: string; before: string; after: string }[]
): ForgeProposal | undefined {
  const changed = files.filter((f) => f.before !== f.after);
  if (changed.length === 0) return undefined;
  return {
    id: uuid(),
    status: "pending",
    summary,
    files: changed,
  };
}

async function ruleBasedProposal(
  workspacePath: string,
  triggerMessage: string,
  chatContext: string
): Promise<ForgeResult> {
  const lower = triggerMessage.toLowerCase();
  const before = await readWorkspaceFile(workspacePath, CONFIG_PATH);
  let after = before;
  const notes: string[] = [];

  const lr = extractLearningRate(triggerMessage) ?? extractLearningRate(chatContext);
  if (
    lower.includes("learning rate") ||
    lower.includes("lr") ||
    extractLearningRate(triggerMessage) !== null
  ) {
    if (lr !== null) {
      after = setYamlScalar(after, "learning_rate", String(lr));
      notes.push(`Set learning rate to ${lr}`);
    }
  }

  const epochs = extractEpochs(triggerMessage) ?? extractEpochs(chatContext);
  if (lower.includes("epoch") || extractEpochs(triggerMessage) !== null) {
    if (epochs !== null) {
      after = setYamlScalar(after, "epochs", String(epochs));
      notes.push(`Set epochs to ${epochs}`);
    }
  }

  if (lower.includes("augmentation") || lower.includes("augment")) {
    if (lower.includes("disable") || lower.includes("turn off")) {
      after = after.replace(/random_flip:\s*true/, "random_flip: false");
      notes.push("Disable random_flip augmentation");
    } else {
      after = after.replace(/random_flip:\s*false/, "random_flip: true");
      notes.push("Enable random_flip augmentation");
    }
  }

  const proposal = proposalFromFiles(notes.join(" · ") || "Update experiment config", [
    { path: CONFIG_PATH, before, after },
  ]);

  if (proposal) {
    return {
      content: `Proposed config changes. Review the diff, then Apply if the team agrees.\n${proposal.summary}`,
      proposal,
    };
  }

  if (lower.includes("train") && !lower.includes("training rate")) {
    return {
      content:
        "Ready to train. Use **Start training** (or Smoke train) in Charts — that runs `python scripts/train.py` as a job, not a one-off terminal command.",
    };
  }

  if (lower.includes("evaluate") || lower.includes("eval")) {
    return {
      content: "Run `python scripts/evaluate.py` in the terminal, or train first so a `best.pt` checkpoint exists.",
    };
  }

  return {
    content: `I've read the team discussion. I will not edit files until you Apply a proposal. Try:\n• "@forge set learning rate to 3e-4"\n• "@forge run 30 epochs"\n• "@forge disable augmentation"\n• "@forge start training"`,
  };
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return JSON.parse(raw.slice(start, end + 1));
}

async function llmProposal(
  sessionId: string,
  workspacePath: string,
  triggerMessage: string,
  recentChat: ChatMessage[]
): Promise<ForgeResult | null> {
  if (!llmEnabled()) return null;

  const before = await readWorkspaceFile(workspacePath, CONFIG_PATH);
  const plan = sessionStore.getPlan(sessionId)?.content ?? "";
  const chatContext = recentChat
    .slice(-16)
    .map((m) => `${m.userName}: ${m.content}`)
    .join("\n");

  const system = `You are Forge, an ML experiment copilot. Propose edits to config/experiment.yaml only.
Return JSON: {"summary":"short","content":"full yaml file"}.
Do not invent keys. Keep valid YAML. Do not wrap in markdown unless needed.`;

  const user = `Plan:\n${plan.slice(0, 2000)}\n\nChat:\n${chatContext}\n\nRequest:\n${triggerMessage}\n\nCurrent ${CONFIG_PATH}:\n${before}`;

  let text = "";
  try {
    if (OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message || `OpenAI ${res.status}`);
      text = json.choices?.[0]?.message?.content ?? "";
    } else if (ANTHROPIC_API_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      const json = (await res.json()) as {
        content?: { type: string; text?: string }[];
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message || `Anthropic ${res.status}`);
      text = json.content?.find((b) => b.type === "text")?.text ?? "";
    }
  } catch (err) {
    console.warn("Forge LLM failed, using rules:", err);
    return null;
  }

  try {
    const parsed = extractJsonObject(text) as { summary?: string; content?: string } | null;
    const after = parsed?.content?.trim();
    if (!after) return null;
    const proposal = proposalFromFiles(parsed?.summary || "LLM config proposal", [
      { path: CONFIG_PATH, before, after: after.endsWith("\n") ? after : `${after}\n` },
    ]);
    if (!proposal) {
      return { content: "The model suggested no file changes." };
    }
    return {
      content: `Proposed config changes (LLM). Review the diff, then Apply if the team agrees.\n${proposal.summary}`,
      proposal,
    };
  } catch {
    return null;
  }
}

export async function handleForgeRequest(
  sessionId: string,
  triggerMessage: string,
  recentChat: ChatMessage[]
): Promise<ForgeResult> {
  const session = sessionStore.get(sessionId);
  if (!session) return { content: "I couldn't find this experiment session." };

  const chatContext = recentChat
    .slice(-12)
    .map((m) => `${m.userName}: ${m.content}`)
    .join("\n");

  const lower = triggerMessage.toLowerCase();
  if (lower.includes("plan") && !extractLearningRate(triggerMessage) && !extractEpochs(triggerMessage)) {
    const plan = sessionStore.getPlan(sessionId);
    if (plan) {
      return {
        content: `Here's the current experiment plan. Review it with your team before applying config changes:\n\n${plan.content.slice(0, 800)}`,
      };
    }
  }

  const fromLlm = await llmProposal(sessionId, session.workspacePath, triggerMessage, recentChat);
  if (fromLlm?.proposal) return fromLlm;

  return ruleBasedProposal(session.workspacePath, triggerMessage, chatContext);
}

export function createAgentMessage(sessionId: string, result: ForgeResult): ChatMessage {
  return {
    id: uuid(),
    sessionId,
    userId: AGENT_USER_ID,
    userName: AGENT_NAME,
    content: result.content,
    timestamp: new Date().toISOString(),
    type: "agent",
    proposal: result.proposal,
  };
}

export function shouldInvokeForge(content: string): boolean {
  return FORGE_MENTION.test(content);
}
