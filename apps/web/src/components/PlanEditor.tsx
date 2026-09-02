"use client";

import { useEffect, useState } from "react";
import { fetchPlan, savePlan } from "@/lib/api";
import { useSessionSocket } from "@/hooks/useSocket";

export function PlanEditor({ sessionId, userId }: { sessionId: string; userId: string }) {
  const socket = useSessionSocket(sessionId, "user");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("Plan");

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
    <div className="flex flex-col h-full bg-surface">
      <div className="px-3 py-2 border-b border-border flex justify-between items-center">
        <span className="text-sm font-medium">{title}</span>
        <button onClick={save} className="h-7 px-2 rounded-md border border-border text-sm hover:bg-surface-2">
          Save
        </button>
      </div>
      <textarea
        className="flex-1 w-full p-4 text-sm resize-none border-0 outline-none min-h-0 leading-relaxed"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}
