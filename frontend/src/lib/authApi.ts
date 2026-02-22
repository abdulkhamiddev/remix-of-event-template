import { apiFetch } from "@/lib/apiClient.ts";
import type { AuthState, AuthUser } from "@/types/auth.ts";

interface AuthResponse {
  access?: string;
  accessToken?: string;
  user?: AuthUser | null;
}

const buildIdentifierPayload = (identifier: string, password: string) => {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");

  return isEmail
    ? { email: trimmed, password }
    : { username: trimmed, password };
};

const normalizeAuthResponse = (data: AuthResponse): AuthState => ({
  accessToken: data.access ?? data.accessToken ?? null,
  currentUser: data.user ?? null,
});

export const loginRequest = async (identifier: string, password: string): Promise<AuthState> => {
  const payload = buildIdentifierPayload(identifier, password);
  const data = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify(payload),
  });

  return normalizeAuthResponse(data);
};

export const registerRequest = async (identifier: string, password: string): Promise<AuthState> => {
  const payload = buildIdentifierPayload(identifier, password);
  const data = await apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify(payload),
  });

  return normalizeAuthResponse(data);
};

export const telegramMagicLoginRequest = async (token: string): Promise<AuthState> => {
  const data = await apiFetch<AuthResponse>("/api/auth/telegram/magic", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ token }),
  });
  return normalizeAuthResponse(data);
};

export const logoutRequest = async (): Promise<void> => {
  await apiFetch<void>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export const logoutAllRequest = async (): Promise<void> => {
  await apiFetch<void>("/api/auth/logout-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "GET",
  });
};
