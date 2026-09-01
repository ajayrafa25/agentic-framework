"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [architecture, setArchitecture] = useState("resnet50");
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
      createdBy: "u1",
    });
    router.push(`/session/${session.id}`);
  }

  const field = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-link";

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader />
      <div className="max-w-lg mx-auto px-6 py-8">
        <Link href="/" className="text-sm text-link hover:underline">
          Experiments
        </Link>
        <h1 className="text-xl font-semibold mt-3 mb-4">New experiment</h1>
        <form onSubmit={handleCreate} className="space-y-4 border border-border rounded-md bg-surface p-4">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              className={`${field} font-mono`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="resnet50-cifar10-lr-sweep"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              className={`${field} min-h-[72px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this run is testing"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium">Architecture</span>
              <input className={`${field} font-mono`} value={architecture} onChange={(e) => setArchitecture(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Dataset</span>
              <input className={`${field} font-mono`} value={dataset} onChange={(e) => setDataset(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link href="/" className="h-8 px-3 rounded-md border border-border text-sm inline-flex items-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="h-8 px-3 rounded-md bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
