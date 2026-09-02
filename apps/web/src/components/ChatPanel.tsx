"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ForgeProposal } from "@agentic/shared";
import { useSessionSocket } from "@/hooks/useSocket";
import { applyProposal, dismissProposal } from "@/lib/api";

function ProposalCard({
  sessionId,
  proposal,
  onUpdate,
}: {
  sessionId: string;
  proposal: ForgeProposal;
  onUpdate: (msg: ChatMessage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const file = proposal.files[0];

  async function run(fn: () => Promise<ChatMessage>) {
    setBusy(true);
    try {
      onUpdate(await fn());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border border-border bg-surface-2 p-2">
      <div className="text-[11px] font-semibold text-muted mb-1">
        Proposal · {proposal.status}
        {file ? ` · ${file.path}` : ""}
      </div>
      {file && file.before !== file.after ? (
        <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto bg-[#0d1117] text-[#c9d1d9] rounded p-2">
          {file.after}
        </pre>
      ) : null}
      {proposal.status === "pending" ? (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => applyProposal(sessionId, proposal.id))}
            className="h-6 px-2 rounded-md bg-accent text-[#1a1a1a] text-[12px] font-medium disabled:opacity-60"
          >
            Apply
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => dismissProposal(sessionId, proposal.id))}
            className="h-6 px-2 rounded-md border border-border text-[12px] disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ChatPanel({ sessionId, userName, userId }: { sessionId: string; userName: string; userId: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on("chat:history", (history: ChatMessage[]) => setMessages(history));
    socket.on("chat:message", (msg: ChatMessage) => setMessages((prev) => [...prev, msg]));
    socket.on("proposal:updated", (msg: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });
    return () => {
      socket.off("chat:history");
      socket.off("chat:message");
      socket.off("proposal:updated");
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    if (!input.trim()) return;
    socket.emit("chat:send", { sessionId, userId, content: input.trim() });
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted">Discussion</div>
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className="py-2 border-b border-border last:border-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{m.userName}</span>
              {m.type === "agent" && (
                <span className="text-[10px] uppercase tracking-wide text-muted">agent</span>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap mt-0.5">{m.content}</div>
            {m.proposal ? (
              <ProposalCard
                sessionId={sessionId}
                proposal={m.proposal}
                onUpdate={(msg) => setMessages((prev) => prev.map((x) => (x.id === msg.id ? msg : x)))}
              />
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-border">
        <input
          className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm outline-none focus:border-link"
          placeholder="Message… @forge to propose a config change"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
        />
      </div>
    </div>
  );
}
