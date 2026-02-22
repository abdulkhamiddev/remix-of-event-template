import type { AuthState, AuthUser } from "@/types/auth.ts";

const LEGACY_STORAGE_KEY = "auth-state";

const emptyState: AuthState = {
  accessToken: null,
  currentUser: null,
};

const listeners = new Set<(state: AuthState) => void>();

let cachedState: AuthState = { ...emptyState };

const notify = () => {
  for (const listener of listeners) {
    listener({ ...cachedState });
  }
};

// Best-effort: remove legacy persisted tokens from previous versions.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export const authSession = {
  getState: (): AuthState => ({ ...cachedState }),
  setState: (nextState: AuthState) => {
    cachedState = { ...nextState };
    notify();
  },
  updateState: (partial: Partial<AuthState>) => {
    cachedState = { ...cachedState, ...partial };
    notify();
  },
  clearState: () => {
    cachedState = { ...emptyState };
    notify();
  },
  subscribe: (listener: (state: AuthState) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setAccessToken: (token: string | null) => {
    cachedState = { ...cachedState, accessToken: token };
    notify();
  },
  setCurrentUser: (user: AuthUser | null) => {
    cachedState = { ...cachedState, currentUser: user };
    notify();
  },
};

