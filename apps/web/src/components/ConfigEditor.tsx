"use client";

import { useEffect, useState } from "react";
import { fetchFile, saveFile } from "@/lib/api";

export function ConfigEditor({ sessionId }: { sessionId: string }) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchFile(sessionId, "config/experiment.yaml").then((f) => setContent(f.content ?? ""));
  }, [sessionId]);

  async function save() {
    await saveFile(sessionId, "config/experiment.yaml", content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-3 py-2 border-b border-border flex justify-between items-center">
        <span className="text-sm font-mono text-muted">config/experiment.yaml</span>
        <button onClick={save} className="h-7 px-2 rounded-md border border-border text-sm hover:bg-surface-2">
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <textarea
        className="flex-1 w-full p-3 font-mono text-[13px] resize-none border-0 outline-none min-h-0 leading-relaxed"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
