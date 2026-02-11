import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  parseISO,
  isWithinInterval,
} from 'date-fns';
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
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

type TimeFilter = 'weekly' | 'monthly' | 'yearly';

const Analytics: React.FC = () => {
  const { tasks } = useTaskContext();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('weekly');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (timeFilter === 'weekly') {
      const start = startOfDay(subDays(now, 6));
      const end = endOfDay(now);
      return { start, end };
    }
    if (timeFilter === 'monthly') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    return { start: startOfYear(now), end: endOfYear(now) };
  }, [timeFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskDate = parseISO(task.scheduledDate);
      return isWithinInterval(taskDate, dateRange);
    });
  }, [tasks, dateRange]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((t) => t.status === 'completed').length;
    const overdue = filteredTasks.filter((t) => t.status === 'overdue').length;
    const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, overdue, productivity };
  }, [filteredTasks]);

  const categoryStats = useMemo(() => {
    const distribution: Record<string, { total: number; completed: number }> = {};

    filteredTasks.forEach((task) => {
      if (!distribution[task.category]) {
        distribution[task.category] = { total: 0, completed: 0 };
      }
      distribution[task.category].total++;
      if (task.status === 'completed') {
        distribution[task.category].completed++;
      }
    });

    return Object.entries(distribution)
      .map(([name, data]) => ({
        name,
        total: data.total,
        completed: data.completed,
        percentage: stats.total > 0 ? Math.round((data.total / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTasks, stats.total]);

  const trendData = useMemo(() => {
    if (timeFilter === 'yearly') {
      const months = eachMonthOfInterval(dateRange);
      const tasksByMonth = new Map<string, typeof filteredTasks>();

      filteredTasks.forEach((task) => {
        const key = format(parseISO(task.scheduledDate), 'yyyy-MM');
        const current = tasksByMonth.get(key) || [];
        current.push(task);
        tasksByMonth.set(key, current);
      });

      return months.map((date) => {
        const key = format(date, 'yyyy-MM');
        const monthTasks = tasksByMonth.get(key) || [];
        const completed = monthTasks.filter((t) => t.status === 'completed').length;
        const overdue = monthTasks.filter((t) => t.status === 'overdue').length;
        const total = monthTasks.length;

        return {
          label: format(date, 'MMM'),
          total,
          completed,
          overdue,
          productivity: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });
    }

    const days = eachDayOfInterval(dateRange);
    const tasksByDate = new Map<string, typeof filteredTasks>();

    filteredTasks.forEach((task) => {
      const key = task.scheduledDate;
      const current = tasksByDate.get(key) || [];
      current.push(task);
      tasksByDate.set(key, current);
    });

    return days.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const dayTasks = tasksByDate.get(key) || [];
      const completed = dayTasks.filter((t) => t.status === 'completed').length;
      const overdue = dayTasks.filter((t) => t.status === 'overdue').length;
      const total = dayTasks.length;

      return {
        label: timeFilter === 'weekly' ? format(date, 'EEE') : format(date, 'd'),
        total,
        completed,
        overdue,
        productivity: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }, [filteredTasks, timeFilter, dateRange]);

  const productivePeriods = useMemo(() => {
    if (timeFilter === 'yearly') {
      const months = eachMonthOfInterval(dateRange);
      return months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart);
        const monthTasks = filteredTasks.filter((task) => {
          const d = parseISO(task.scheduledDate);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        });
        const completed = monthTasks.filter((t) => t.status === 'completed').length;
        const total = monthTasks.length;
        return {
          label: format(monthStart, 'MMM'),
          completed,
          total,
          rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });
    }

    const days = eachDayOfInterval(dateRange);
    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const dayTasks = filteredTasks.filter((t) => t.scheduledDate === key);
      const completed = dayTasks.filter((t) => t.status === 'completed').length;
      const total = dayTasks.length;
      return {
        label: timeFilter === 'weekly' ? format(day, 'EEE') : format(day, 'd'),
        completed,
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }, [filteredTasks, timeFilter, dateRange]);

  const rangeLabel = useMemo(() => {
    if (timeFilter === 'weekly') {
      return `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d')}`;
    }
    if (timeFilter === 'monthly') {
      return format(dateRange.start, 'MMMM yyyy');
    }
    return format(dateRange.start, 'yyyy');
  }, [timeFilter, dateRange]);

  const productivityChartConfig = {
    productivity: {
      label: 'Productivity %',
      color: 'hsl(var(--primary))',
    },
  };

  const completionChartConfig = {
    completed: {
      label: 'Completed',
      color: 'hsl(var(--success))',
    },
    overdue: {
      label: 'Overdue',
      color: 'hsl(var(--destructive))',
    },
  };

  const categoryChartConfig = {
    total: {
      label: 'Tasks',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Track your productivity and task completion</p>
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {rangeLabel}
          </div>
        </div>

        {/* Time filter */}
        <div className="flex gap-2">
          {(['weekly', 'monthly', 'yearly'] as TimeFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={timeFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeFilter(filter)}
              className="capitalize"
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Productivity</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.productivity}%</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.completed}</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <span className="text-sm text-muted-foreground">Overdue</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.overdue}</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-accent">
              <BarChart3 className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Total Tasks</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Area Chart */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Productivity Trend</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="w-full overflow-x-auto">
            <ChartContainer
              config={productivityChartConfig}
              className="h-64 w-full min-w-[520px] !aspect-auto"
            >
              <AreaChart data={trendData} margin={{ left: -10, right: 16, top: 10, bottom: 0 }}>
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

        {/* Completed vs Overdue Line Chart */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Completed vs Overdue</h3>
            <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="w-full overflow-x-auto">
            <ChartContainer
              config={completionChartConfig}
              className="h-64 w-full min-w-[520px] !aspect-auto"
            >
              <LineChart data={trendData} margin={{ left: -10, right: 16, top: 10, bottom: 0 }}>
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

      {/* Category distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Category Distribution</h3>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          {categoryStats.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <ChartContainer
                config={categoryChartConfig}
                className="h-64 w-full min-w-[520px] !aspect-auto"
              >
                <BarChart
                  data={categoryStats}
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

        {/* Most Productive Periods */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            {timeFilter === 'yearly' ? 'Most Productive Months' : 'Most Productive Days'}
          </h3>
          <div
            className={cn(
              'grid gap-2',
              timeFilter === 'weekly'
                ? 'grid-cols-4 sm:grid-cols-7'
                : timeFilter === 'yearly'
                ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6'
                : 'grid-cols-7'
            )}
          >
            {productivePeriods.map((period, idx) => (
              <div
                key={idx}
                className={cn(
                  'p-3 rounded-lg text-center transition-smooth',
                  period.rate >= 80
                    ? 'bg-success/20'
                    : period.rate >= 50
                    ? 'bg-warning/20'
                    : 'bg-muted'
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
        </div>
      </div>

      {/* Overdue Impact */}
      {stats.overdue > 0 && stats.total > 0 && (
        <div className="glass-card rounded-2xl p-6 border-destructive/30">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Overdue Impact</h3>
              <p className="text-muted-foreground mt-1">
                You have {stats.overdue} overdue {stats.overdue === 1 ? 'task' : 'tasks'} affecting your productivity.
                This reduces your completion rate by approximately{' '}
                {Math.round((stats.overdue / stats.total) * 100)}%.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
