import type { AuthState, AuthUser } from "@/types/auth.ts";

const MOCK_USER: AuthUser = {
  id: "dev-user",
  email: "dev.user@example.com",
  username: "devuser",
  displayName: "Dev User",
};

const MOCK_TOKENS = {
  accessToken: "mock-access-token",
};

export const isAuthMockEnabled = () => import.meta.env.VITE_AUTH_MOCK === "true";

export const getMockAuthState = (): AuthState => ({
  ...MOCK_TOKENS,
  currentUser: { ...MOCK_USER },
});

export const isMockAccessToken = (token: string | null) =>
  Boolean(token && token.startsWith("mock-"));
