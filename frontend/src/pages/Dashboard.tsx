import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, Clock, ClipboardList, ListChecks, Flame, Compass, TriangleAlert, Sparkles, Target } from 'lucide-react';
import { TaskCard } from '@/components/tasks/TaskCard.tsx';
import { KPICard } from '@/components/tasks/KPICard.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { getStreakToday } from '@/lib/streakApi.ts';
import { getTodaySuggestions } from '@/lib/suggestionsApi.ts';
import { apiFetch } from '@/lib/apiClient.ts';
import type { StreakTodayResponse } from '@/types/streak.ts';
import type { TodaySuggestion } from '@/types/suggestions.ts';
import type { Task } from '@/types/task.ts';

interface SettingsResponse {
  minDailyTasks?: number;
  streakThresholdPercent?: number;
}

interface TaskPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface TaskListResponse {
  items: Task[];
  pagination: TaskPagination;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [streakToday, setStreakToday] = useState<StreakTodayResponse | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [isTodayTasksLoading, setIsTodayTasksLoading] = useState<boolean>(true);
  const [todaySuggestions, setTodaySuggestions] = useState<TodaySuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState<boolean>(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [minDailyTasks, setMinDailyTasks] = useState<number>(3);

  const loadTodayTasks = useCallback(async () => {
    try {
      const payload = await apiFetch<TaskListResponse>('/api/tasks/today');
      setTodayTasks(payload.items);
    } catch (_error) {
      setTodayTasks([]);
    } finally {
      setIsTodayTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodayTasks();
  }, [loadTodayTasks]);

  const completedToday = todayTasks.filter((t) => t.status === 'completed').length;
  const totalToday = todayTasks.length;
  const remainingToday = todayTasks.filter((t) => t.status !== 'completed').length;
  const productivity = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  useEffect(() => {
    let active = true;

    const loadStreak = async () => {
      try {
        const [todayPayload, settingsPayload, suggestionsPayload] = await Promise.all([
          getStreakToday(),
          apiFetch<SettingsResponse>('/api/settings'),
          getTodaySuggestions(),
        ]);
        if (!active) return;
        setStreakToday(todayPayload);
        setMinDailyTasks(settingsPayload.minDailyTasks ?? 3);
        setTodaySuggestions((suggestionsPayload.suggestions ?? []).slice(0, 3));
        setSuggestionsError(null);
      } catch (_error) {
        if (!active) return;
        setStreakToday(null);
        setMinDailyTasks(3);
        setTodaySuggestions([]);
        setSuggestionsError('Could not load guidance.');
      } finally {
        if (!active) return;
        setIsSuggestionsLoading(false);
      }
    };

    loadStreak();
    return () => {
      active = false;
    };
  }, []);

  const suggestionMeta: Record<TodaySuggestion['type'], { icon: React.ReactNode; className: string }> = {
    warning: {
      icon: <TriangleAlert className="h-4 w-4" />,
      className: 'border-destructive/30 bg-destructive/5',
    },
    hint: {
      icon: <Compass className="h-4 w-4" />,
      className: 'border-border/70 bg-card/60',
    },
    focus: {
      icon: <Target className="h-4 w-4" />,
      className: 'border-primary/30 bg-primary/5',
    },
    praise: {
      icon: <Sparkles className="h-4 w-4" />,
      className: 'border-success/30 bg-success/5',
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your task overview for today.
          </p>
        </div>
        <Button onClick={() => navigate('/tasks/create')} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Task
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Tasks (Today)"
          value={totalToday}
          subtitle="All scheduled today"
          icon={ClipboardList}
          variant="default"
        />
        <KPICard
          title="Tasks Remaining"
          value={remainingToday}
          subtitle="Still pending today"
          icon={Clock}
          variant={remainingToday === 0 ? 'success' : 'warning'}
        />
        <KPICard
          title="Completed Tasks"
          value={completedToday}
          subtitle="Done today"
          icon={CheckCircle}
          variant={completedToday > 0 ? 'success' : 'default'}
        />
        <KPICard
          title="Today's Productivity (%)"
          value={`${productivity}%`}
          subtitle="Completion rate"
          icon={ListChecks}
          variant={productivity >= 80 ? 'success' : productivity >= 50 ? 'warning' : 'default'}
        />
      </div>

      <div className="app-surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Today&apos;s Guidance</h2>
        </div>

        {isSuggestionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading guidance...</p>
        ) : suggestionsError ? (
          <p className="text-sm text-muted-foreground">{suggestionsError}</p>
        ) : todaySuggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guidance right now. Keep your momentum.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {todaySuggestions.map((suggestion) => {
              const meta = suggestionMeta[suggestion.type];
              return (
                <div key={suggestion.id} className={`rounded-lg border p-3 ${meta.className}`}>
                  <div className="mb-2 flex items-center gap-2 text-foreground">
                    {meta.icon}
                    <p className="text-xs font-medium uppercase tracking-wide">{suggestion.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="app-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-foreground">Streak</h2>
          </div>
          {streakToday?.qualified ? <Badge className="bg-success/15 text-success border-success/30">Qualified</Badge> : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Streak</p>
            <p className="text-3xl font-bold text-foreground">{streakToday?.currentStreak ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Today</p>
            <p className="text-2xl font-semibold text-foreground">
              {streakToday ? `${streakToday.completed}/${streakToday.scheduled}` : '0/0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ratio</p>
            <p className="text-2xl font-semibold text-foreground">
              {streakToday ? `${Math.round(streakToday.ratio)}%` : '0%'}
            </p>
          </div>
        </div>

        {streakToday && streakToday.scheduled < minDailyTasks ? (
          <p className="text-sm text-muted-foreground">Not enough scheduled tasks to qualify today.</p>
        ) : null}
      </div>

      {/* Today's Task List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Today's Tasks</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            View All
          </Button>
        </div>

        {isTodayTasksLoading ? (
          <div className="app-surface p-12 text-center">
            <p className="text-muted-foreground">Loading today&apos;s tasks...</p>
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="app-surface p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No tasks for today
            </h3>
            <p className="text-muted-foreground mb-6">
              Create a new task to get started with your productivity journey.
            </p>
            <Button onClick={() => navigate('/tasks/create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Task
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {todayTasks.map((task) => (
              <TaskCard key={task.occurrenceKey ?? `${task.id}-${task.scheduledDate}`} task={task} onTaskMutated={loadTodayTasks} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
