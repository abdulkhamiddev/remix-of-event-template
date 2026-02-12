from ninja import Schema


class StreakRuleSchema(Schema):
    minDailyTasks: int
    thresholdPercent: int


class StreakDaySchema(Schema):
    date: str
    scheduled: int
    completed: int
    ratio: float
    qualified: bool


class StreakSummarySchema(Schema):
    currentStreak: int
    bestStreak: int
    todayQualified: bool
    rules: StreakRuleSchema
    days: list[StreakDaySchema]


class StreakTodaySchema(Schema):
    scheduled: int
    completed: int
    ratio: float
    qualified: bool
    currentStreak: int

