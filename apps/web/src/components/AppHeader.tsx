"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const onNew = pathname === "/new";

  return (
    <header className="h-12 shrink-0 border-b border-border bg-surface px-4 flex items-center gap-6">
      <Link href="/" className="font-semibold text-[15px]">
        Forge
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/"
          className={`px-2 py-1 rounded-md ${
            !onNew ? "bg-surface-2 text-text" : "text-muted hover:text-text"
          }`}
        >
          Experiments
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/new"
          className="h-7 px-3 rounded-md bg-accent text-white text-sm font-medium inline-flex items-center hover:opacity-90"
        >
          New experiment
        </Link>
        <span className="text-sm text-muted">Maggie</span>
      </div>
    </header>
  );
}
