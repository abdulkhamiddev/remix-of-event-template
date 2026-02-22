import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Repeat, AlertTriangle, Play, Check, Eye, Timer } from 'lucide-react';
import { Task } from '@/types/task.ts';
import { useTaskContext } from '@/contexts/TaskContext.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Progress } from '@/components/ui/progress.tsx';
import { cn } from '@/lib/utils.ts';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
  showDate?: boolean;
  onTaskMutated?: () => void | Promise<void>;
}

const formatSeconds = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, showDate = false, onTaskMutated }) => {
  const navigate = useNavigate();
  const { completeTask, startTimer, updateTimerRemaining } = useTaskContext();
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  const [timerProgress, setTimerProgress] = useState<number>(0);

  // Timer logic
  useEffect(() => {
    if (!task.hasTimer || !task.timerStartedAt || task.status === 'completed') return;

    const updateTimer = () => {
      const startTime = new Date(task.timerStartedAt!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, task.timerDuration - elapsed);

      updateTimerRemaining(task.id, remaining);

      setTimerDisplay(formatSeconds(remaining));
      const progress = task.timerDuration > 0
        ? ((task.timerDuration - remaining) / task.timerDuration) * 100
        : 0;
      setTimerProgress(progress);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [task.hasTimer, task.timerStartedAt, task.timerDuration, task.id, task.status, updateTimerRemaining]);

  const priorityClasses = {
    low: 'priority-low',
    medium: 'priority-medium',
    high: 'priority-high',
  };

  const statusClasses = {
    pending: 'status-pending',
    completed: 'status-completed',
    overdue: 'status-overdue',
  };

  const canComplete =
    task.status !== 'overdue' &&
    task.status !== 'completed' &&
    (!task.hasTimer || task.timerRemaining === 0);

  const canStartTimer = task.hasTimer && !task.timerStartedAt && task.status === 'pending';

  const timerText = task.timerStartedAt
    ? timerDisplay || formatSeconds(task.timerRemaining)
    : formatSeconds(task.timerDuration);

  const handleStartTimer = async () => {
    try {
      await startTimer(task.id, task.scheduledDate);
      if (onTaskMutated) await onTaskMutated();
    } catch (error) {
      console.error("Failed to start timer:", error);
    }
  };

  const handleComplete = async () => {
    try {
      await completeTask(task.id, task.scheduledDate);
      if (onTaskMutated) await onTaskMutated();
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  };

  return (
    <div
      className={cn(
        'app-surface p-5 space-y-4 transition-smooth hover:-translate-y-0.5',
        task.status === 'overdue' && 'border-destructive/30 bg-destructive/5'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className={cn('border', priorityClasses[task.priority])}>{task.priority}</Badge>
            <Badge variant="outline" className={statusClasses[task.status]}>
              {task.status}
            </Badge>
            {task.hasDeadline && (
              <Badge className="border-warning/40 text-warning bg-warning/10">
                <Clock className="h-3 w-3 mr-1" />
                {task.deadlineTime}
              </Badge>
            )}
          </div>
          <h3
            className={cn(
              'text-lg font-semibold text-foreground truncate',
              task.status === 'completed' && 'line-through opacity-60'
            )}
          >
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {showDate ? format(new Date(task.scheduledDate), 'MMM d') : task.category}
        </span>

        {task.hasTimer && (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {timerText}
          </span>
        )}

        {task.isRecurring && (
          <span className="flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            {task.recurringPattern}
          </span>
        )}

        {task.status === 'overdue' && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            Locked
          </span>
        )}
      </div>

      {/* Type badges */}
      <div className="flex flex-wrap items-center gap-2">
        {task.hasTimer && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            Timer
          </Badge>
        )}
        {task.hasDeadline && (
          <Badge variant="secondary" className="bg-warning/10 text-warning">
            Deadline
          </Badge>
        )}
        {task.isRecurring && (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            Recurring
          </Badge>
        )}
      </div>

      {/* Timer progress */}
      {task.hasTimer && task.timerStartedAt && task.status !== 'completed' && (
        <div className="space-y-1">
          <Progress value={timerProgress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{timerDisplay} remaining</span>
            <span>{Math.round(timerProgress)}%</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/tasks/${task.id}?date=${encodeURIComponent(task.scheduledDate)}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View Detail
        </Button>

        {canStartTimer && (
          <Button size="sm" className="flex-1" onClick={handleStartTimer}>
            <Play className="h-4 w-4 mr-1" />
            Start Task
          </Button>
        )}

        {canComplete && !canStartTimer && (
          <Button size="sm" variant="default" className="flex-1" onClick={handleComplete}>
            <Check className="h-4 w-4 mr-1" />
            Mark as Completed
          </Button>
        )}
      </div>
    </div>
  );
};
