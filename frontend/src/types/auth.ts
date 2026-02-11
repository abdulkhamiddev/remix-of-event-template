export interface AuthUser {
  id?: string;
  email?: string;
  username?: string;
  displayName?: string;
}

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface AuthState extends AuthTokens {
  currentUser: AuthUser | null;
}
