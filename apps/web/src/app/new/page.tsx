"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession } from "@/lib/api";

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

  return (
    <div className="min-h-screen bg-bg p-6 max-w-xl mx-auto">
      <Link href="/" className="text-sm text-muted hover:text-accent">← Dashboard</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-6">New experiment session</h1>
      <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <label className="block">
          <span className="text-sm text-muted">Experiment name</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="vit-l-custom-finetune"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are we trying to learn or improve?"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Model architecture</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
            value={architecture}
            onChange={(e) => setArchitecture(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Dataset</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2"
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent/20 text-accent py-2 font-medium hover:bg-accent/30 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create session"}
        </button>
      </form>
    </div>
  );
}
