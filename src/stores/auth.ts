import { create } from "zustand";
import type { User } from "../api/types";
import { local } from "../lib/storage";

const KEY = "tester.auth";

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string, user?: User | null) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

function load(): Pick<AuthState, "access" | "refresh" | "user"> {
  try {
    const raw = local.get(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* buzilgan qiymat */ }
  return { access: null, refresh: null, user: null };
}

export const useAuth = create<AuthState>((set, get) => ({
  ...load(),
  setTokens: (access, refresh, user) => {
    const next = { access, refresh, user: user === undefined ? get().user : user };
    local.set(KEY, JSON.stringify(next));
    set(next);
  },
  setUser: user => {
    const { access, refresh } = get();
    local.set(KEY, JSON.stringify({ access, refresh, user }));
    set({ user });
  },
  clear: () => {
    local.remove(KEY);
    set({ access: null, refresh: null, user: null });
  },
}));
