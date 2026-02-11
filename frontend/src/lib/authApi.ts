import { apiFetch } from "@/lib/apiClient.ts";
import type { AuthState, AuthUser } from "@/types/auth.ts";

interface AuthResponse {
  access?: string;
  refresh?: string;
  accessToken?: string;
  refreshToken?: string;
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
  refreshToken: data.refresh ?? data.refreshToken ?? null,
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

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "GET",
  });
};
