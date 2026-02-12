export type SuggestionType = "warning" | "hint" | "focus" | "praise";

export interface TodaySuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  text: string;
}

export interface TodaySuggestionsResponse {
  date: string;
  suggestions: TodaySuggestion[];
}
