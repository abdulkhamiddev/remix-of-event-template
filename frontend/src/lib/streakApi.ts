import { apiFetch } from "@/lib/apiClient.ts";
import type { StreakSummaryResponse, StreakTodayResponse } from "@/types/streak.ts";

export const getStreakSummary = async (start: string, end: string): Promise<StreakSummaryResponse> => {
  const query = new URLSearchParams({ start, end }).toString();
  return apiFetch<StreakSummaryResponse>(`/api/streak/summary?${query}`);
};

export const getStreakToday = async (): Promise<StreakTodayResponse> => {
  return apiFetch<StreakTodayResponse>("/api/streak/today");
};

