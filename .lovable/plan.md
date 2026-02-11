

## Fix: "Most Productive Days" Section Not Responding to Time Filter

### Problem
The `productiveDays` computation always groups tasks by day-of-week (Sunday through Saturday), regardless of whether the user selects Weekly, Monthly, or Yearly. This means the "Most Productive Days" section never changes its structure or data presentation when filters switch.

### Solution

Replace the single `productiveDays` memo with a filter-aware `productivePeriods` memo that adapts its grouping logic:

**1. Weekly filter** -- Group by the 7 specific days in the selected week (e.g., "Mon Feb 5", "Tue Feb 6", ...). Show completion rate per calendar day.

**2. Monthly filter** -- Group by each day in the selected month (e.g., "1", "2", ... "28"). Show completion rate per calendar day. Display in a scrollable or wrapped grid.

**3. Yearly filter** -- Group by month (Jan through Dec). Show completion rate per month.

### Technical Details

**File: `src/pages/Analytics.tsx`**

- Replace the `productiveDays` useMemo (lines 161-184) with a new `productivePeriods` useMemo that:
  - For **weekly**: uses `eachDayOfInterval(dateRange)` to iterate each day, counts completed/total for that specific date, formats label as short day name (e.g., "Mon").
  - For **monthly**: uses `eachDayOfInterval(dateRange)` to iterate each day of the month, counts completed/total for that specific date, formats label as day number (e.g., "1", "2").
  - For **yearly**: uses `eachMonthOfInterval(dateRange)` to iterate each month, counts completed/total for tasks in that month, formats label as month abbreviation (e.g., "Jan").
  - Each entry returns `{ label, completed, total, rate }`.

- Update the section title (line 410) from static "Most Productive Days" to dynamically show "Most Productive Days" for weekly/monthly and "Most Productive Months" for yearly.

- Update the rendering grid (lines 411-431):
  - For weekly: keep `grid-cols-7` layout.
  - For monthly: use a flexible wrapping grid (e.g., `grid-cols-7` with wrapping to show ~28-31 day cells).
  - For yearly: use `grid-cols-6` or `grid-cols-4` layout for 12 months.

- The color coding logic (green for >= 80%, yellow for >= 50%, gray otherwise) stays the same.

This ensures every part of the analytics page -- KPIs, charts, and the "Most Productive" section -- all stay fully synchronized with the selected time filter.
