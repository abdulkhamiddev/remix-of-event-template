from ninja import Schema


class AnalyticsStatsSchema(Schema):
    total: int
    completed: int
    overdue: int
    productivity: int
    totalTasks: int
    created: int
    completionRate: int
    timerMinutes: int


class AnalyticsTrendPointSchema(Schema):
    label: str
    total: int
    completed: int
    overdue: int
    productivity: int
    created: int
    timerMinutes: int


class AnalyticsCategoryStatSchema(Schema):
    name: str
    total: int
    completed: int
    percentage: int
    completionRate: int


class AnalyticsProductivePeriodSchema(Schema):
    label: str
    completed: int
    total: int
    rate: int
    percent: int
    kind: str | None = None


class AnalyticsPayloadSchema(Schema):
    rangeLabel: str
    stats: AnalyticsStatsSchema
    trendData: list[AnalyticsTrendPointSchema]
    categoryStats: list[AnalyticsCategoryStatSchema]
    productivePeriods: list[AnalyticsProductivePeriodSchema]
