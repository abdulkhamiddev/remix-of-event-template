from typing import Literal

from ninja import Schema

InsightType = Literal["strength", "warning", "hint"]
WeekdayName = Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class WeeklyReviewMetricsSchema(Schema):
    created: int
    completed: int
    completionRate: int
    overdue: int
    timerMinutes: int
    topCategory: str | None = None
    mostProductiveDay: WeekdayName | None = None


class WeeklyReviewInsightSchema(Schema):
    type: InsightType
    text: str


class WeeklyReviewPayloadSchema(Schema):
    rangeLabel: str
    metrics: WeeklyReviewMetricsSchema
    insights: list[WeeklyReviewInsightSchema]
    nextWeekFocus: str

