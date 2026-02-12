import React, { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ArrowLeft, ArrowRight, Clock3, Folder, ListChecks, TrendingUp, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ApiError } from "@/lib/apiClient.ts";
import { getWeeklyReview } from "@/lib/reviewApi.ts";
import type { WeeklyReviewInsight, WeeklyReviewResponse } from "@/types/review.ts";

const buildEmptyReview = (anchorDate: string): WeeklyReviewResponse => {
  const weekStart = startOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  return {
    rangeLabel: `${format(weekStart, "yyyy-MM-dd")} - ${format(weekEnd, "yyyy-MM-dd")}`,
    metrics: {
      created: 0,
      completed: 0,
      completionRate: 0,
      overdue: 0,
      timerMinutes: 0,
      topCategory: null,
      mostProductiveDay: null,
    },
    insights: [],
    nextWeekFocus: "Plan deep work on your most productive day and keep consistency.",
  };
};

const insightToneClass: Record<WeeklyReviewInsight["type"], string> = {
  strength: "border-success/30 bg-success/10",
  warning: "border-warning/30 bg-warning/10",
  hint: "border-border/60 bg-card/70",
};

const WeeklyReview: React.FC = () => {
  const [anchorDate, setAnchorDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [review, setReview] = useState<WeeklyReviewResponse>(() => buildEmptyReview(format(new Date(), "yyyy-MM-dd")));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const payload = await getWeeklyReview(anchorDate);
        if (!active) return;
        setReview(payload);
      } catch (requestError) {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          setError("Session expired. Please sign in again.");
        } else {
          setError("Could not load weekly review.");
        }
        setReview(buildEmptyReview(anchorDate));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [anchorDate]);

  const localWeekLabel = useMemo(() => {
    const current = parseISO(anchorDate);
    if (Number.isNaN(current.getTime())) return anchorDate;
    const start = startOfWeek(current, { weekStartsOn: 1 });
    const end = addDays(start, 6);
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }, [anchorDate]);

  const shiftWeek = (step: number) => {
    setAnchorDate((prev) => {
      const parsed = parseISO(prev);
      const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      return format(addDays(base, step * 7), "yyyy-MM-dd");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Your Week in Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">{review.rangeLabel || localWeekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Prev week
          </Button>
          <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
            Next week
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-3xl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <>
          <section className="app-surface-elevated px-6 py-8">
            <p className="section-label">Completion</p>
            <p className="mt-3 text-5xl font-semibold text-foreground">{review.metrics.completionRate}% completed</p>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="app-surface p-5">
              <p className="section-label">Created</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{review.metrics.created}</p>
            </div>
            <div className="app-surface p-5">
              <p className="section-label">Completed</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{review.metrics.completed}</p>
            </div>
            <div className="app-surface p-5">
              <p className="section-label">Overdue</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{review.metrics.overdue}</p>
            </div>
            <div className="app-surface p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <p className="section-label">Timer Minutes</p>
              </div>
              <p className="mt-2 text-3xl font-semibold text-foreground">{review.metrics.timerMinutes}</p>
            </div>
            <div className="app-surface p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Folder className="h-4 w-4" />
                <p className="section-label">Top Category</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{review.metrics.topCategory ?? "None"}</p>
            </div>
            <div className="app-surface p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <p className="section-label">Most Productive Day</p>
              </div>
              <p className="mt-2 text-xl font-semibold text-foreground">{review.metrics.mostProductiveDay ?? "None"}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="section-label">Insights</h2>
            {review.insights.length === 0 ? (
              <div className="app-surface p-5 text-sm text-muted-foreground">
                No insights generated for this week.
              </div>
            ) : (
              review.insights.slice(0, 3).map((insight, index) => (
                <div key={`${insight.type}-${index}`} className={`rounded-2xl border p-4 text-foreground ${insightToneClass[insight.type]}`}>
                  <div className="mb-2 flex items-center gap-2">
                    {insight.type === "warning" ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : insight.type === "strength" ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <ListChecks className="h-4 w-4" />
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide">{insight.type}</span>
                  </div>
                  <p className="text-sm leading-6 text-foreground">{insight.text}</p>
                </div>
              ))
            )}
          </section>

          <section className="app-surface-elevated px-6 py-6">
            <p className="section-label">Next Week Focus</p>
            <p className="mt-3 text-xl font-medium leading-8 text-foreground">{review.nextWeekFocus}</p>
          </section>
        </>
      )}
    </div>
  );
};

export default WeeklyReview;
