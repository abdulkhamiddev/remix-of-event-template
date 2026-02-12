import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  LineChart as LineChartIcon,
} from "lucide-react";
import { format, parse } from "date-fns";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart.tsx";
import { useAuth } from "@/contexts/AuthContext.tsx";
import { ApiError } from "@/lib/apiClient.ts";
import { getMonthlyAnalytics, getWeeklyAnalytics, getYearlyAnalytics } from "@/lib/analyticsApi.ts";
import type { AnalyticsFilter, AnalyticsPayload } from "@/types/analytics.ts";

const EMPTY_ANALYTICS: AnalyticsPayload = {
  rangeLabel: "",
  stats: {
    total: 0,
    completed: 0,
    overdue: 0,
    productivity: 0,
  },
  trendData: [],
  categoryStats: [],
  productivePeriods: [],
};

const productivityChartConfig = {
  productivity: {
    label: "Productivity %",
    color: "hsl(var(--primary))",
  },
};

const completionChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--success))",
  },
  overdue: {
    label: "Overdue",
    color: "hsl(var(--destructive))",
  },
};

const categoryChartConfig = {
  total: {
    label: "Tasks",
    color: "hsl(var(--primary))",
  },
};

const buildRangeLabel = (filter: AnalyticsFilter, selectedDate: string, selectedMonth: string, selectedYear: string) => {
  if (filter === "weekly") {
    const weekDate = parse(selectedDate, "yyyy-MM-dd", new Date());
    return `Week of ${format(weekDate, "MMM d, yyyy")}`;
  }

  if (filter === "monthly") {
    const monthDate = parse(`${selectedMonth}-01`, "yyyy-MM-dd", new Date());
    return format(monthDate, "MMMM yyyy");
  }

  return selectedYear;
};

const mostProductiveTitle = (filter: AnalyticsFilter) => {
  if (filter === "yearly") return "Most Productive Month";
  return "Most Productive Day";
};

const Analytics: React.FC = () => {
  const { accessToken } = useAuth();

  const [timeFilter, setTimeFilter] = useState<AnalyticsFilter>("weekly");
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), "yyyy"));

  const [analytics, setAnalytics] = useState<AnalyticsPayload>(EMPTY_ANALYTICS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAnalytics = async () => {
      if (!accessToken) {
        setAnalytics(EMPTY_ANALYTICS);
        setError("Authentication required to load analytics.");
        return;
      }

      if (timeFilter === "weekly" && !selectedDate) {
        setAnalytics(EMPTY_ANALYTICS);
        setError("Select a valid date for weekly analytics.");
        return;
      }

      if (timeFilter === "monthly") {
        const [yearValue, monthValue] = selectedMonth.split("-");
        if (!yearValue || !monthValue || Number.isNaN(Number(yearValue)) || Number.isNaN(Number(monthValue))) {
          setAnalytics(EMPTY_ANALYTICS);
          setError("Select a valid month for monthly analytics.");
          return;
        }
      }

      if (timeFilter === "yearly" && Number.isNaN(Number(selectedYear))) {
        setAnalytics(EMPTY_ANALYTICS);
        setError("Select a valid year for yearly analytics.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let payload: AnalyticsPayload;

        if (timeFilter === "weekly") {
          payload = await getWeeklyAnalytics({ date: selectedDate });
        } else if (timeFilter === "monthly") {
          const [yearValue, monthValue] = selectedMonth.split("-");
          payload = await getMonthlyAnalytics({
            year: Number(yearValue),
            month: Number(monthValue),
          });
        } else {
          payload = await getYearlyAnalytics({ year: Number(selectedYear) });
        }

        if (!active) return;

        const rangeLabel = payload.rangeLabel || buildRangeLabel(timeFilter, selectedDate, selectedMonth, selectedYear);
        setAnalytics({ ...payload, rangeLabel });
      } catch (requestError) {
        if (!active) return;

        if (requestError instanceof ApiError && requestError.status === 401) {
          setError("Session expired. Please sign in again.");
        } else {
          setError("Unable to load analytics data right now.");
        }

        setAnalytics({
          ...EMPTY_ANALYTICS,
          rangeLabel: buildRangeLabel(timeFilter, selectedDate, selectedMonth, selectedYear),
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      active = false;
    };
  }, [accessToken, timeFilter, selectedDate, selectedMonth, selectedYear]);

  const topProductivePeriod = useMemo(() => {
    const monthlyLabelPattern = /^(?:[1-9]|[12][0-9]|3[01])$/;
    const source = analytics.productivePeriods.filter((period) => {
      if (timeFilter !== "monthly") return true;
      if (period.kind) return period.kind === "dayOfMonth";
      return monthlyLabelPattern.test(period.label);
    });

    return source.reduce<(typeof source)[number] | null>((best, current) => {
      if (!best || current.rate > best.rate) return current;
      return best;
    }, null);
  }, [analytics.productivePeriods, timeFilter]);

  const productivePeriods = useMemo(() => {
    const monthlyLabelPattern = /^(?:[1-9]|[12][0-9]|3[01])$/;
    return analytics.productivePeriods.filter((period) => {
      if (timeFilter !== "monthly") return true;
      if (period.kind) return period.kind === "dayOfMonth";
      return monthlyLabelPattern.test(period.label);
    });
  }, [analytics.productivePeriods, timeFilter]);

  const pickerControl = useMemo(() => {
    if (timeFilter === "weekly") {
      return (
        <Input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="w-[180px]"
        />
      );
    }

    if (timeFilter === "monthly") {
      return (
        <Input
          type="month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          className="w-[180px]"
        />
      );
    }

    return (
      <Input
        type="number"
        min="2000"
        max="2100"
        value={selectedYear}
        onChange={(event) => setSelectedYear(event.target.value)}
        className="w-[140px]"
      />
    );
  }, [selectedDate, selectedMonth, selectedYear, timeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your productivity and task completion</p>
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {analytics.rangeLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {pickerControl}
          {(["weekly", "monthly", "yearly"] as AnalyticsFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={timeFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeFilter(filter)}
              className="capitalize"
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="app-surface rounded-2xl p-4 border-destructive/30 text-sm text-destructive">{error}</div>
      )}

      {isLoading ? (
        <div className="app-surface rounded-2xl p-6 text-muted-foreground">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="app-surface p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">Productivity</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{analytics.stats.productivity}%</p>
            </div>

            <div className="app-surface p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <span className="text-sm text-muted-foreground">Completed</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{analytics.stats.completed}</p>
            </div>

            <div className="app-surface p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <span className="text-sm text-muted-foreground">Overdue</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{analytics.stats.overdue}</p>
            </div>

            <div className="app-surface p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-accent">
                  <BarChart3 className="h-5 w-5 text-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Total Tasks</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{analytics.stats.total}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-surface p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Productivity Trend</h3>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="w-full overflow-x-auto">
                <ChartContainer
                  config={productivityChartConfig}
                  className="h-64 w-full min-w-[520px] !aspect-auto"
                >
                  <AreaChart data={analytics.trendData} margin={{ left: -10, right: 16, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="productivityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-productivity)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-productivity)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="productivity"
                      stroke="var(--color-productivity)"
                      strokeWidth={2}
                      fill="url(#productivityGradient)"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>

            <div className="app-surface p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Completed vs Overdue</h3>
                <LineChartIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="w-full overflow-x-auto">
                <ChartContainer config={completionChartConfig} className="h-64 w-full min-w-[520px] !aspect-auto">
                  <LineChart data={analytics.trendData} margin={{ left: -10, right: 16, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="var(--color-completed)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="overdue"
                      stroke="var(--color-overdue)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="app-surface p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Category Distribution</h3>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              {analytics.categoryStats.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <ChartContainer
                    config={categoryChartConfig}
                    className="h-64 w-full min-w-[520px] !aspect-auto"
                  >
                    <BarChart
                      data={analytics.categoryStats}
                      layout="vertical"
                      margin={{ left: 24, right: 16, top: 5, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[6, 6, 6, 6]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No tasks in this period</div>
              )}
            </div>

            <div className="app-surface p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">{mostProductiveTitle(timeFilter)}</h3>
              {topProductivePeriod && (
                <p className="text-sm text-muted-foreground mb-4">
                  Top period: <span className="font-medium text-foreground">{topProductivePeriod.label}</span> ({topProductivePeriod.rate}%)
                </p>
              )}
              <div
                className={cn(
                  "grid gap-2",
                  timeFilter === "weekly"
                    ? "grid-cols-4 sm:grid-cols-7"
                    : timeFilter === "yearly"
                    ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
                    : "grid-cols-7"
                )}
              >
                {productivePeriods.map((period) => (
                  <div
                    key={period.label}
                    className={cn(
                      "p-3 rounded-lg text-center transition-smooth",
                      period.rate >= 80 ? "bg-success/20" : period.rate >= 50 ? "bg-warning/20" : "bg-muted"
                    )}
                  >
                    <p className="text-xs font-medium text-foreground">{period.label}</p>
                    <p className="text-xl font-bold text-foreground mt-1">{period.rate}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {period.completed}/{period.total}
                    </p>
                  </div>
                ))}
              </div>
              {productivePeriods.length === 0 && (
                <div className="text-sm text-muted-foreground py-4">No productivity data for this period.</div>
              )}
            </div>
          </div>

          {analytics.stats.overdue > 0 && analytics.stats.total > 0 && (
            <div className="app-surface p-6 border-destructive/30">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Overdue Impact</h3>
                  <p className="text-muted-foreground mt-1">
                    You have {analytics.stats.overdue} overdue {analytics.stats.overdue === 1 ? "task" : "tasks"} affecting your productivity.
                    This reduces your completion rate by approximately {Math.round((analytics.stats.overdue / analytics.stats.total) * 100)}%.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Analytics;
