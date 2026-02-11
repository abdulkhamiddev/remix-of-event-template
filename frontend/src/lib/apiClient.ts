import { authStorage } from "@/lib/authStorage.ts";

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  skipRefresh?: boolean;
};

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const REFRESH_ENDPOINT = "/api/auth/refresh";

let refreshPromise: Promise<string | null> | null = null;

const buildUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const buildHeaders = (options: ApiFetchOptions, accessToken: string | null) => {
  const headers = new Headers(options.headers ?? {});
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

const parseResponse = async <T,>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
};

const getErrorMessage = (data: unknown, fallback: string) => {
  if (!data || typeof data !== "object") return fallback;

  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.message === "string") return record.message;

  return fallback;
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
};

const refreshTokens = async (): Promise<string | null> => {
  const { refreshToken, currentUser } = authStorage.getState();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(buildUrl(REFRESH_ENDPOINT), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) {
          return null;
        }

        const data = await parseResponse<Record<string, unknown>>(response);
        const newAccess = typeof data.access === "string" ? data.access : null;
        const newRefresh = typeof data.refresh === "string" ? data.refresh : null;

        if (!newAccess) return null;

        authStorage.setState({
          accessToken: newAccess,
          refreshToken: newRefresh ?? refreshToken,
          currentUser,
        });

        return newAccess;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

export const apiFetch = async <T,>(path: string, options: ApiFetchOptions = {}): Promise<T> => {
  const accessToken = authStorage.getState().accessToken;
  const headers = buildHeaders(options, accessToken);

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401 && options.auth !== false && !options.skipRefresh) {
    const newAccess = await refreshTokens();
    if (newAccess) {
      const retryHeaders = buildHeaders(options, newAccess);
      const retryResponse = await fetch(buildUrl(path), {
        ...options,
        headers: retryHeaders,
      });

      if (!retryResponse.ok) {
        const data = await parseResponse<unknown>(retryResponse);
        throw new ApiError(
          getErrorMessage(data, retryResponse.statusText),
          retryResponse.status,
          data
        );
      }

      return await parseResponse<T>(retryResponse);
    }

    authStorage.clearState();
    redirectToLogin();
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    const data = await parseResponse<unknown>(response);
    throw new ApiError(
      getErrorMessage(data, response.statusText),
      response.status,
      data
    );
  }

  return await parseResponse<T>(response);
};

export const refreshAccessToken = refreshTokens;

export const isNetworkError = (error: unknown) => error instanceof TypeError;
