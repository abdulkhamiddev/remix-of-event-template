export interface StreakRule {
  minDailyTasks: number;
  thresholdPercent: number;
}

export interface StreakDaySummary {
  date: string;
  scheduled: number;
  completed: number;
  ratio: number;
  qualified: boolean;
}

export interface StreakSummaryResponse {
  currentStreak: number;
  bestStreak: number;
  todayQualified: boolean;
  rules: StreakRule;
  days: StreakDaySummary[];
}

export interface StreakTodayResponse {
  scheduled: number;
  completed: number;
  ratio: number;
  qualified: boolean;
  currentStreak: number;
}

