import { apiFetch } from "@/lib/apiClient.ts";
import type { TodaySuggestionsResponse } from "@/types/suggestions.ts";

export const getTodaySuggestions = async (): Promise<TodaySuggestionsResponse> => {
  return apiFetch<TodaySuggestionsResponse>("/api/suggestions/today");
};
