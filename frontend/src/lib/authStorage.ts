import type { AuthState } from "@/types/auth.ts";

const STORAGE_KEY = "auth-state";

const emptyState: AuthState = {
  accessToken: null,
  refreshToken: null,
  currentUser: null,
};

const listeners = new Set<(state: AuthState) => void>();

const readState = (): AuthState => {
  if (typeof window === "undefined") {
    return { ...emptyState };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...emptyState };

    const parsed = JSON.parse(raw) as Partial<AuthState> | null;
    if (!parsed || typeof parsed !== "object") return { ...emptyState };

    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      currentUser: parsed.currentUser ?? null,
    };
  } catch (error) {
    console.error("Failed to read auth state from storage:", error);
    return { ...emptyState };
  }
};

let cachedState: AuthState = readState();

const notify = () => {
  listeners.forEach((listener) => listener({ ...cachedState }));
};

const persist = (state: AuthState) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to persist auth state:", error);
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    cachedState = readState();
    notify();
  });
}

export const authStorage = {
  getState: () => ({ ...cachedState }),
  setState: (nextState: AuthState) => {
    cachedState = { ...nextState };
    persist(cachedState);
    notify();
  },
  updateState: (partial: Partial<AuthState>) => {
    cachedState = { ...cachedState, ...partial };
    persist(cachedState);
    notify();
  },
  clearState: () => {
    cachedState = { ...emptyState };
    persist(cachedState);
    notify();
  },
  subscribe: (listener: (state: AuthState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const getInitialAuthState = () => authStorage.getState();
