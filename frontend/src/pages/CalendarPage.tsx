import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext.tsx';
import { TaskCard } from '@/components/tasks/TaskCard.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { cn } from '@/lib/utils.ts';
import { useIsMobile } from '@/hooks/use-mobile.tsx';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  getDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  startOfDay,
  isBefore,
} from 'date-fns';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarView = 'month' | 'week';

const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, getTasksByDate } = useTaskContext();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<CalendarView>(isMobile ? 'week' : 'month');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));

  useEffect(() => {
    setViewMode(isMobile ? 'week' : 'month');
  }, [isMobile]);

  useEffect(() => {
    if (viewMode === 'week') {
      setCurrentWeekStart(startOfWeek(selectedDate));
    } else {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [viewMode, selectedDate]);

  const todayStart = startOfDay(new Date());
  const isPastDate = (date: Date) => isBefore(startOfDay(date), todayStart);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddTaskForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/tasks/create?date=${dateStr}&source=calendar`, {
      state: { selectedDate: dateStr, fromCalendar: true },
    });
  };

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const startPadding = getDay(start);
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);

    return [...paddedDays, ...days];
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeekStart);
    const end = endOfWeek(currentWeekStart);
    return eachDayOfInterval({ start, end });
  }, [currentWeekStart]);

  const getDayTasks = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((t) => t.scheduledDate === dateStr);
  };

  const selectedTasks = selectedDate ? getTasksByDate(selectedDate) : [];
  const selectedIsPast = selectedDate ? isPastDate(selectedDate) : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
          <p className="text-muted-foreground mt-1">View and manage your tasks by date</p>
        </div>
        <Button onClick={() => navigate('/tasks/create')}>
          <Plus className="h-5 w-5 mr-2" />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  viewMode === 'month'
                    ? setCurrentMonth(subMonths(currentMonth, 1))
                    : setCurrentWeekStart(subWeeks(currentWeekStart, 1))
                }
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg sm:text-xl font-semibold text-foreground">
                {viewMode === 'month'
                  ? format(currentMonth, 'MMMM yyyy')
                  : `${format(weekDays[0], 'MMM d')} � ${format(weekDays[6], 'MMM d')}`}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  viewMode === 'month'
                    ? setCurrentMonth(addMonths(currentMonth, 1))
                    : setCurrentWeekStart(addWeeks(currentWeekStart, 1))
                }
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'month' ? 'default' : 'outline'}
                onClick={() => setViewMode('month')}
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'week' ? 'default' : 'outline'}
                onClick={() => setViewMode('week')}
              >
                Weekly
              </Button>
            </div>
          </div>

          {viewMode === 'month' ? (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const dayTasks = getDayTasks(day);
                  const taskCount = dayTasks.length;
                  const hasOverdue = dayTasks.some((t) => t.status === 'overdue');
                  const allCompleted = taskCount > 0 && dayTasks.every((t) => t.status === 'completed');
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPast = isPastDate(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleSelectDate(day)}
                      className={cn(
                        'relative aspect-square p-1.5 rounded-lg transition-smooth flex flex-col items-center justify-between',
                        'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                        isToday(day) && 'bg-primary/10 ring-1 ring-primary/30',
                        isSelected && 'bg-primary text-primary-foreground',
                        !isSameMonth(day, currentMonth) && 'opacity-30',
                        isPast && 'opacity-70'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isSelected ? 'text-primary-foreground' : 'text-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {taskCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={isSelected ? 'secondary' : 'outline'}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            {taskCount}
                          </Badge>
                          {hasOverdue && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                          {allCompleted && !hasOverdue && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayTasks = getDayTasks(day);
                const taskCount = dayTasks.length;
                const hasOverdue = dayTasks.some((t) => t.status === 'overdue');
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isPast = isPastDate(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => handleSelectDate(day)}
                    className={cn(
                      'rounded-xl border border-border/60 p-3 text-left transition-smooth min-h-[96px]',
                      'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                      isSelected && 'bg-primary/10 ring-1 ring-primary/30',
                      isToday(day) && 'border-primary/40',
                      isPast && 'opacity-70'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                        <p className="text-lg font-semibold text-foreground">{format(day, 'd')}</p>
                      </div>
                      {taskCount > 0 && (
                        <Badge variant="secondary" className="h-6 px-2">
                          {taskCount}
                        </Badge>
                      )}
                    </div>
                    {hasOverdue && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Overdue
                      </div>
                    )}
                    {isToday(day) && (
                      <div className="mt-2 text-[11px] text-primary">Today</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Pending
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success" />
              Completed
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              Overdue
            </div>
          </div>
        </div>

        {/* Selected day tasks */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
                </h3>
                {selectedDate && (
                  <Badge variant="secondary">
                    {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}
                  </Badge>
                )}
              </div>
              {selectedDate && !selectedIsPast && (
                <Button size="sm" onClick={() => handleAddTaskForDate(selectedDate)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              )}
            </div>
            {selectedDate && selectedIsPast && (
              <p className="text-xs text-muted-foreground mt-3">Past dates are read-only.</p>
            )}
          </div>

          {selectedDate ? (
            selectedTasks.length > 0 ? (
              <div className="space-y-3">
                {selectedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-8 text-center">
                <p className="text-muted-foreground mb-4">No tasks for this date</p>
                {!selectedIsPast ? (
                  <Button variant="outline" size="sm" onClick={() => handleAddTaskForDate(selectedDate)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Past dates are read-only.</p>
                )}
              </div>
            )
          ) : (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">Click on a date to view tasks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
