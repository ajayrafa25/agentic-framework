"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";

export default function NewSessionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [architecture, setArchitecture] = useState("resnet18");
  const [dataset, setDataset] = useState("cifar10");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const session = await createSession({
      name,
      description,
      modelArchitecture: architecture,
      dataset,
      createdBy: user.id,
    });
    router.push(`/session/${session.id}`);
  }

  const field =
    "mt-1 w-full h-8 rounded-md border border-border bg-surface px-2.5 text-[13px] outline-none focus:border-link";

  return (
    <AppShell>
      <header className="h-12 shrink-0 border-b border-border bg-surface px-4 flex items-center text-[13px] text-muted">
        <Link href="/" className="hover:text-text">
          Runs
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">New run</span>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleCreate} className="max-w-md space-y-4">
          <label className="block">
            <span className="text-[12px] font-medium">Name</span>
            <input
              className={`${field} font-mono`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="resnet18-cifar10-lr-sweep"
              required
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium">Notes</span>
            <textarea
              className={`${field} h-20 py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this run is testing"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-medium">Architecture</span>
              <input className={`${field} font-mono`} value={architecture} onChange={(e) => setArchitecture(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium">Dataset</span>
              <input className={`${field} font-mono`} value={dataset} onChange={(e) => setDataset(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="h-8 px-3 rounded-md bg-accent text-[#1a1a1a] text-[13px] font-medium disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create run"}
            </button>
            <Link href="/" className="h-8 px-3 rounded-md border border-border text-[13px] inline-flex items-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
