import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthState, AuthUser } from "@/types/auth.ts";
import { authStorage, getInitialAuthState } from "@/lib/authStorage.ts";
import { fetchCurrentUser, loginRequest, registerRequest } from "@/lib/authApi.ts";
import { isNetworkError, refreshAccessToken } from "@/lib/apiClient.ts";
import { getMockAuthState, isAuthMockEnabled, isMockAccessToken } from "@/lib/authMock.ts";

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => getInitialAuthState());

  useEffect(() => {
    const unsubscribe = authStorage.subscribe((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateUser = async () => {
      if (!authState.accessToken || authState.currentUser) return;
      if (isAuthMockEnabled() && isMockAccessToken(authState.accessToken)) {
        authStorage.updateState({ currentUser: getMockAuthState().currentUser });
        return;
      }

      try {
        const user = await fetchCurrentUser();
        if (active) {
          authStorage.updateState({ currentUser: user });
        }
      } catch (error) {
        if (isAuthMockEnabled() && isNetworkError(error)) {
          authStorage.updateState({ currentUser: getMockAuthState().currentUser });
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
        refreshToken: result.refreshToken,
        currentUser: result.currentUser,
      };

      authStorage.setState(nextState);

      if (!result.currentUser && result.accessToken) {
        const user = await fetchCurrentUser();
        authStorage.updateState({ currentUser: user });
      }
    } catch (error) {
      if (isAuthMockEnabled() && isNetworkError(error)) {
        authStorage.setState(getMockAuthState());
        return;
      }

      throw error;
    }
  }, []);

  const register = useCallback(async (identifier: string, password: string) => {
    try {
      const result = await registerRequest(identifier, password);
      if (result.accessToken) {
        authStorage.setState(result);
      } else {
        const loginResult = await loginRequest(identifier, password);
        authStorage.setState(loginResult);
      }

      if (!authStorage.getState().currentUser) {
        const user = await fetchCurrentUser();
        authStorage.updateState({ currentUser: user });
      }
    } catch (error) {
      if (isAuthMockEnabled() && isNetworkError(error)) {
        authStorage.setState(getMockAuthState());
        return;
      }

      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authStorage.clearState();
  }, []);

  const refresh = useCallback(async () => {
    return refreshAccessToken();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      accessToken: authState.accessToken,
      refreshToken: authState.refreshToken,
      currentUser: authState.currentUser,
      isAuthenticated: Boolean(authState.accessToken),
      login,
      register,
      logout,
      refresh,
    }),
    [authState.accessToken, authState.refreshToken, authState.currentUser, login, register, logout, refresh]
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
