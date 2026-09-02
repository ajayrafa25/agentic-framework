"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@agentic/shared";
import { DEMO_USERS } from "@agentic/shared";
import { fetchAuthConfig, fetchMe, getForgeToken, setForgeToken } from "@/lib/api";

const fallback: AuthUser = {
  id: DEMO_USERS[0].id,
  name: DEMO_USERS[0].name,
  source: "demo",
};

const AuthContext = createContext<{
  user: AuthUser;
  githubOAuth: boolean;
  llm: boolean;
  refresh: () => Promise<void>;
}>({ user: fallback, githubOAuth: false, llm: false, refresh: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(fallback);
  const [githubOAuth, setGithubOAuth] = useState(false);
  const [llm, setLlm] = useState(false);

  async function refresh() {
    const [me, cfg] = await Promise.all([fetchMe(), fetchAuthConfig()]);
    setUser(me);
    setGithubOAuth(cfg.githubOAuth);
    setLlm(cfg.llm);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("forge_token");
    if (token) {
      setForgeToken(token);
      params.delete("forge_token");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
    void refresh();
  }, []);

  const value = useMemo(() => ({ user, githubOAuth, llm, refresh }), [user, githubOAuth, llm]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useForgeToken() {
  return getForgeToken();
}
