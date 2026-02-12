import { apiFetch } from "@/lib/apiClient.ts";
import type {
  AnalyticsCategoryStat,
  AnalyticsPayload,
  AnalyticsProductivePeriod,
  AnalyticsStats,
  AnalyticsTrendPoint,
  MonthlyAnalyticsParams,
  WeeklyAnalyticsParams,
  YearlyAnalyticsParams,
} from "@/types/analytics.ts";

interface BackendAnalyticsPayload {
  rangeLabel?: string;
  range_label?: string;
  stats?: Partial<AnalyticsStats>;
  summary?: Partial<AnalyticsStats>;
  trendData?: Partial<AnalyticsTrendPoint>[];
  trend_data?: Partial<AnalyticsTrendPoint>[];
  trend?: Partial<AnalyticsTrendPoint>[];
  categoryStats?: Partial<AnalyticsCategoryStat>[];
  category_stats?: Partial<AnalyticsCategoryStat>[];
  categories?: Partial<AnalyticsCategoryStat>[];
  productivePeriods?: Partial<AnalyticsProductivePeriod>[];
  productive_periods?: Partial<AnalyticsProductivePeriod>[];
  mostProductive?: Partial<AnalyticsProductivePeriod>[];
  most_productive?: Partial<AnalyticsProductivePeriod>[];
}

type UnknownRecord = Record<string, unknown>;

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
};

const normalizeStats = (stats?: Partial<AnalyticsStats> | UnknownRecord): AnalyticsStats => {
  const record = (stats ?? {}) as UnknownRecord;
  return {
    total: toNumber(record.total ?? record.total_tasks),
    completed: toNumber(record.completed ?? record.completed_tasks),
    overdue: toNumber(record.overdue ?? record.overdue_tasks),
    productivity: toNumber(record.productivity ?? record.productivity_rate),
  };
};

const normalizeTrendPoint = (point: Partial<AnalyticsTrendPoint> | UnknownRecord): AnalyticsTrendPoint => {
  const record = point as UnknownRecord;
  const labelCandidate =
    record.label ?? record.day ?? record.month ?? record.period ?? record.period_label ?? record.date;

  return {
    label: typeof labelCandidate === "string" ? labelCandidate : "",
    total: toNumber(record.total ?? record.total_tasks),
    completed: toNumber(record.completed ?? record.completed_tasks),
    overdue: toNumber(record.overdue ?? record.overdue_tasks),
    productivity: toNumber(record.productivity ?? record.productivity_rate ?? record.completion_rate),
  };
};

const normalizeCategory = (item: Partial<AnalyticsCategoryStat> | UnknownRecord): AnalyticsCategoryStat => {
  const record = item as UnknownRecord;
  const nameCandidate = record.name ?? record.category ?? record.category_name;

  return {
    name: typeof nameCandidate === "string" ? nameCandidate : "",
    total: toNumber(record.total ?? record.total_tasks ?? record.count),
    completed: toNumber(record.completed ?? record.completed_tasks),
    percentage: toNumber(record.percentage ?? record.share_percent),
  };
};

const normalizeProductivePeriod = (
  item: Partial<AnalyticsProductivePeriod> | UnknownRecord
): AnalyticsProductivePeriod => {
  const record = item as UnknownRecord;
  const labelCandidate =
    record.label ?? record.day ?? record.month ?? record.period ?? record.period_label ?? record.date;

  return {
    label: typeof labelCandidate === "string" ? labelCandidate : "",
    completed: toNumber(record.completed ?? record.completed_tasks),
    total: toNumber(record.total ?? record.total_tasks),
    rate: toNumber(record.rate ?? record.productivity ?? record.completion_rate),
    kind: typeof record.kind === "string" ? record.kind : undefined,
  };
};

const normalizeAnalyticsPayload = (raw: BackendAnalyticsPayload): AnalyticsPayload => {
  const stats = normalizeStats(raw.stats ?? raw.summary);
  const trendSource = raw.trendData ?? raw.trend_data ?? raw.trend ?? [];
  const categorySource = raw.categoryStats ?? raw.category_stats ?? raw.categories ?? [];
  const productiveSourceRaw =
    raw.productivePeriods ?? raw.productive_periods ?? raw.mostProductive ?? raw.most_productive ?? [];
  const trendData = trendSource.map(normalizeTrendPoint);
  const productiveSource =
    productiveSourceRaw.length > 0
      ? productiveSourceRaw.map(normalizeProductivePeriod)
      : trendData.map((point) => ({
          label: point.label,
          completed: point.completed,
          total: point.total,
          rate: point.productivity,
        }));

  return {
    rangeLabel: raw.rangeLabel ?? raw.range_label ?? "",
    stats,
    trendData,
    categoryStats: categorySource.map(normalizeCategory),
    productivePeriods: productiveSource,
  };
};

export const getWeeklyAnalytics = async ({ date }: WeeklyAnalyticsParams) => {
  const payload = await apiFetch<BackendAnalyticsPayload>(`/api/analytics/weekly?date=${encodeURIComponent(date)}`);
  return normalizeAnalyticsPayload(payload);
};

export const getMonthlyAnalytics = async ({ year, month }: MonthlyAnalyticsParams) => {
  const payload = await apiFetch<BackendAnalyticsPayload>(
    `/api/analytics/monthly?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month).padStart(2, "0"))}`
  );
  return normalizeAnalyticsPayload(payload);
};

export const getYearlyAnalytics = async ({ year }: YearlyAnalyticsParams) => {
  const payload = await apiFetch<BackendAnalyticsPayload>(`/api/analytics/yearly?year=${encodeURIComponent(String(year))}`);
  return normalizeAnalyticsPayload(payload);
};
