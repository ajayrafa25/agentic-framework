"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { githubLoginUrl, logout } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inSession = pathname.startsWith("/session/");
  const { user, githubOAuth } = useAuth();

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
        <div className="mt-auto p-3 border-t border-white/10 text-[12px] text-white/70 space-y-2">
          <div className="flex items-center gap-2">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="size-5 rounded-full" />
            ) : (
              <span className="size-5 rounded-full bg-white/20 inline-flex items-center justify-center text-[10px]">
                {user.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate">{user.name}</span>
          </div>
          {user.source === "github" ? (
            <button
              type="button"
              className="text-white/50 hover:text-white"
              onClick={() => logout().then(() => location.reload())}
            >
              Sign out
            </button>
          ) : githubOAuth ? (
            <a href={githubLoginUrl()} className="text-accent hover:underline">
              Sign in with GitHub
            </a>
          ) : (
            <div className="text-white/40">{inSession ? "Workspace" : "demo user"}</div>
          )}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0">{children}</div>
    </div>
  );
}
