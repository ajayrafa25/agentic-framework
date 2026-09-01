"use client";

import { useEffect, useState } from "react";
import { fetchFile, saveFile } from "@/lib/api";

export function ConfigEditor({ sessionId }: { sessionId: string }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchFile(sessionId, "config/experiment.yaml").then((f) => setContent(f.content));
  }, [sessionId]);

  async function save() {
    await saveFile(sessionId, "config/experiment.yaml", content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-xl bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex justify-between items-center">
        <span className="text-sm font-medium">config/experiment.yaml</span>
        <button onClick={save} className="text-xs text-accent hover:underline">
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <textarea
        className="flex-1 w-full bg-surface-2 p-4 font-mono text-sm resize-none border-0 outline-none min-h-0"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
    </div>
  );
}
