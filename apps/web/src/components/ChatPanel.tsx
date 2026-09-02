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
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-border">
        <input
          className="w-full rounded-md border border-border px-2.5 py-1.5 text-sm outline-none focus:border-link"
          placeholder="Message… @forge to change config"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
        />
      </div>
    </div>
  );
}
