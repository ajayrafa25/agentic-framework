"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@agentic/shared";
import { useSessionSocket } from "@/hooks/useSocket";

export function ChatPanel({ sessionId, userName, userId }: { sessionId: string; userName: string; userId: string }) {
  const socket = useSessionSocket(sessionId, userName);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on("chat:history", (history: ChatMessage[]) => setMessages(history));
    socket.on("chat:message", (msg: ChatMessage) => setMessages((prev) => [...prev, msg]));
    return () => {
      socket.off("chat:history");
      socket.off("chat:message");
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
    <div className="flex flex-col h-full border border-border rounded-xl bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">Team chat</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className={m.type === "agent" ? "bg-accent/5 rounded-lg p-3" : ""}>
            <div className="text-xs text-muted mb-1">
              {m.userName}
              {m.type === "agent" && " · agent"}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <input
          className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          placeholder="Discuss with team… use @forge to invoke agent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
        />
        <button onClick={send} className="rounded-lg bg-accent/20 text-accent px-4 text-sm font-medium">
          Send
        </button>
      </div>
    </div>
  );
}
