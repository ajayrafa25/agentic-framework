"use client";

import { useEffect, useState } from "react";
import { fetchPlan, savePlan } from "@/lib/api";
import { useSessionSocket } from "@/hooks/useSocket";

export function PlanEditor({ sessionId, userId }: { sessionId: string; userId: string }) {
  const socket = useSessionSocket(sessionId, "user");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Experiment plan");

  useEffect(() => {
    fetchPlan(sessionId).then((p) => {
      setContent(p.content);
      setTitle(p.title);
    });
    const onPlanUpdated = (p: { content: string; title: string }) => {
      setContent(p.content);
      setTitle(p.title);
    };
    socket.on("plan:updated", onPlanUpdated);
    return () => {
      socket.off("plan:updated", onPlanUpdated);
    };
  }, [sessionId, socket]);

  async function save() {
    const plan = await savePlan(sessionId, content, userId);
    socket.emit("plan:update", { sessionId, content, updatedBy: userId });
    setTitle(plan.title);
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-xl bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button onClick={save} className="text-xs text-accent hover:underline">Save plan</button>
      </div>
      <textarea
        className="flex-1 w-full bg-surface-2 p-4 text-sm resize-none border-0 outline-none min-h-0 leading-relaxed"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}
