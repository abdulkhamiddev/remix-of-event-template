export type ReviewInsightType = "strength" | "warning" | "hint";

export type ReviewWeekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface WeeklyReviewMetrics {
  created: number;
  completed: number;
  completionRate: number;
  overdue: number;
  timerMinutes: number;
  topCategory: string | null;
  mostProductiveDay: ReviewWeekday | null;
}

export interface WeeklyReviewInsight {
  type: ReviewInsightType;
  text: string;
}

export interface WeeklyReviewResponse {
  rangeLabel: string;
  metrics: WeeklyReviewMetrics;
  insights: WeeklyReviewInsight[];
  nextWeekFocus: string;
}

