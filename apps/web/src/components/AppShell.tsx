"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inSession = pathname.startsWith("/session/");

  return (
    <div className="h-dvh flex bg-bg">
      <aside className="w-[220px] shrink-0 bg-sidebar text-white flex flex-col">
        <Link href="/" className="h-12 px-4 flex items-center gap-2 border-b border-white/10">
          <span className="size-4 rounded-[3px] bg-accent" />
          <span className="font-semibold text-[14px] tracking-tight">Forge</span>
        </Link>
        <nav className="p-2 text-[13px]">
          <Link
            href="/"
            className={`flex items-center h-8 px-2 rounded-md ${
              pathname === "/" ? "bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            Runs
          </Link>
          <Link
            href="/new"
            className={`flex items-center h-8 px-2 rounded-md ${
              pathname === "/new" ? "bg-white/10" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            New run
          </Link>
        </nav>
        <div className="mt-auto p-3 border-t border-white/10 text-[12px] text-white/50">
          {inSession ? "Workspace" : "team / default"}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">{children}</div>
    </div>
  );
}
