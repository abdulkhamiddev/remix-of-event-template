import { apiFetch } from "@/lib/apiClient.ts";

interface DetailResponse {
  detail: string;
}

export const forgotPassword = async (emailOrUsername: string): Promise<DetailResponse> => {
  return apiFetch<DetailResponse>("/api/auth/forgot-password", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ emailOrUsername }),
  });
};

export const resetPassword = async (token: string, newPassword: string): Promise<DetailResponse> => {
  return apiFetch<DetailResponse>("/api/auth/reset-password", {
    method: "POST",
    auth: false,
    skipRefresh: true,
    body: JSON.stringify({ token, newPassword }),
  });
};
