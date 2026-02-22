import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthState, AuthUser } from "@/types/auth.ts";
import { authSession } from "@/lib/authSession.ts";
import { fetchCurrentUser, loginRequest, logoutAllRequest, logoutRequest, registerRequest } from "@/lib/authApi.ts";
import { isNetworkError, refreshAccessToken } from "@/lib/apiClient.ts";
import { getMockAuthState, isAuthMockEnabled, isMockAccessToken } from "@/lib/authMock.ts";

interface AuthContextType {
  accessToken: string | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (identifier: string, password: string) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => authSession.getState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = authSession.subscribe((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      // Restore session on reload using HttpOnly refresh cookie.
      try {
        if (isAuthMockEnabled()) {
          return;
        }

        const access = await refreshAccessToken();
        if (!access) return;

        const user = await fetchCurrentUser();
        if (active) {
          authSession.updateState({ currentUser: user });
        }
      } catch (_error) {
        // If /me fails after refresh, clear the session to avoid a broken partial-auth state.
        if (active) authSession.clearState();
      } finally {
        if (active) setIsHydrated(true);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateUser = async () => {
      if (!authState.accessToken || authState.currentUser) return;
      if (isAuthMockEnabled() && isMockAccessToken(authState.accessToken)) {
        authSession.updateState({ currentUser: getMockAuthState().currentUser });
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (active) {
          authSession.updateState({ currentUser: user });
        }
      } catch (error) {
        if (isAuthMockEnabled() && isNetworkError(error)) {
          authSession.updateState({ currentUser: getMockAuthState().currentUser });
        }
      }
    };

    hydrateUser();

    return () => {
      active = false;
    };
  }, [authState.accessToken, authState.currentUser]);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const result = await loginRequest(identifier, password);
      const nextState: AuthState = {
        accessToken: result.accessToken,
        currentUser: result.currentUser,
      };

      authSession.setState(nextState);

      if (!result.currentUser && result.accessToken) {
        const user = await fetchCurrentUser();
        authSession.updateState({ currentUser: user });
      }
    } catch (error) {
      if (isAuthMockEnabled() && isNetworkError(error)) {
        authSession.setState(getMockAuthState());
        return;
      }

      throw error;
    }
  }, []);

  const register = useCallback(async (identifier: string, password: string) => {
    try {
      const result = await registerRequest(identifier, password);
      if (result.accessToken) {
        authSession.setState(result);
      } else {
        const loginResult = await loginRequest(identifier, password);
        authSession.setState(loginResult);
      }

      if (!authSession.getState().currentUser) {
        const user = await fetchCurrentUser();
        authSession.updateState({ currentUser: user });
      }
    } catch (error) {
      if (isAuthMockEnabled() && isNetworkError(error)) {
        authSession.setState(getMockAuthState());
        return;
      }

      throw error;
    }
  }, []);

  const logout = useCallback(async (allDevices = false) => {
    try {
      if (allDevices) {
        await logoutAllRequest();
      } else {
        await logoutRequest();
      }
    } catch (_error) {
      // Clear local auth state even if server-side token revoke fails.
    } finally {
      authSession.clearState();
      if (typeof window !== "undefined") {
        window.location.replace("/landing");
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    return refreshAccessToken();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      accessToken: authState.accessToken,
      currentUser: authState.currentUser,
      isAuthenticated: Boolean(authState.accessToken),
      isHydrated,
      login,
      register,
      logout,
      refresh,
    }),
    [authState.accessToken, authState.currentUser, isHydrated, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
