"use client";

import { useEffect, useState } from "react";
import type { CheckpointInfo } from "@agentic/shared";
import { fetchCheckpoints } from "@/lib/api";
import { relativeTime } from "@/lib/time";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CheckpointsPanel({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<CheckpointInfo[]>([]);

  useEffect(() => {
    fetchCheckpoints(sessionId).then(setItems);
    const interval = setInterval(() => fetchCheckpoints(sessionId).then(setItems), 4000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return (
    <div className="h-full overflow-auto p-4 bg-surface">
      <h3 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-3">Checkpoints</h3>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">No checkpoints yet. Start a training job to write best.pt / last.pt.</p>
      ) : (
        <table className="w-full text-[13px] border border-border rounded-md overflow-hidden">
          <thead className="bg-surface-2 text-muted text-left">
            <tr>
              <th className="font-medium px-3 py-2">File</th>
              <th className="font-medium px-3 py-2">Size</th>
              <th className="font-medium px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.path} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-[12px]">{c.name}</td>
                <td className="px-3 py-2 tabular">{formatSize(c.size)}</td>
                <td className="px-3 py-2 text-muted">{relativeTime(c.mtime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
