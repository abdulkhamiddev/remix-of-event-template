import { apiFetch } from "@/lib/apiClient.ts";
import type { WeeklyReviewResponse } from "@/types/review.ts";

export const getWeeklyReview = async (date?: string): Promise<WeeklyReviewResponse> => {
  const params = new URLSearchParams();
  if (date) {
    params.set("date", date);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return apiFetch<WeeklyReviewResponse>(`/api/review/weekly${suffix}`);
};

