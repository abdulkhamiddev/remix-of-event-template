export type AnalyticsFilter = "weekly" | "monthly" | "yearly";

export interface AnalyticsStats {
  total: number;
  completed: number;
  overdue: number;
  productivity: number;
}

export interface AnalyticsTrendPoint {
  label: string;
  total: number;
  completed: number;
  overdue: number;
  productivity: number;
}

export interface AnalyticsCategoryStat {
  name: string;
  total: number;
  completed: number;
  percentage: number;
}

export interface AnalyticsProductivePeriod {
  label: string;
  completed: number;
  total: number;
  rate: number;
  kind?: string;
}

export interface AnalyticsPayload {
  rangeLabel: string;
  stats: AnalyticsStats;
  trendData: AnalyticsTrendPoint[];
  categoryStats: AnalyticsCategoryStat[];
  productivePeriods: AnalyticsProductivePeriod[];
}

export interface WeeklyAnalyticsParams {
  date: string;
}

export interface MonthlyAnalyticsParams {
  year: number;
  month: number;
}

export interface YearlyAnalyticsParams {
  year: number;
}
