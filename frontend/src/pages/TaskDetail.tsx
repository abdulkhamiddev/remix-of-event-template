import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, Play, Check, Clock, Calendar, Repeat,
  Timer, AlertTriangle, Tag, CheckCircle
} from 'lucide-react';
import { useTaskContext } from '@/contexts/TaskContext.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Progress } from '@/components/ui/progress.tsx';
import { cn } from '@/lib/utils.ts';
import { format, formatDistanceToNow, parseISO, differenceInSeconds } from 'date-fns';
import { toast } from '@/hooks/use-toast.ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.tsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TaskDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { getTaskById, deleteTask, completeTask, startTimer, updateTimerRemaining } = useTaskContext();

  const task = getTaskById(id || '');
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  const [timerProgress, setTimerProgress] = useState<number>(0);
  const [deadlineCountdown, setDeadlineCountdown] = useState<string>('');

  // Timer logic
  useEffect(() => {
    if (!task?.hasTimer || !task.timerStartedAt || task.status === 'completed') return;

    const updateTimer = () => {
      const startTime = new Date(task.timerStartedAt!).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, task.timerDuration - elapsed);

      updateTimerRemaining(task.id, remaining);

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      if (hours > 0) {
        setTimerDisplay(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimerDisplay(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
      setTimerProgress(((task.timerDuration - remaining) / task.timerDuration) * 100);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [task, updateTimerRemaining]);

  // Deadline countdown
  useEffect(() => {
    if (!task?.hasDeadline || !task.deadlineTime || task.status !== 'pending') return;

    const updateDeadline = () => {
      const [hours, minutes] = task.deadlineTime.split(':').map(Number);
      const deadline = parseISO(task.scheduledDate);
      deadline.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const diff = differenceInSeconds(deadline, now);

      if (diff <= 0) {
        setDeadlineCountdown('Passed');
        return;
      }

      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;

      if (h > 24) {
        setDeadlineCountdown(`${Math.floor(h / 24)}d ${h % 24}h remaining`);
      } else if (h > 0) {
        setDeadlineCountdown(`${h}h ${m}m remaining`);
      } else {
        setDeadlineCountdown(`${m}m ${s}s remaining`);
      }
    };

    updateDeadline();
    const interval = setInterval(updateDeadline, 1000);
    return () => clearInterval(interval);
  }, [task]);

  if (!task) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground mb-2">Task not found</h2>
        <Button onClick={() => navigate('/tasks')}>Back to Tasks</Button>
      </div>
    );
  }

  const handleDelete = () => {
    deleteTask(task.id);
    toast({ title: 'Task deleted' });
    navigate('/tasks');
  };

  const handleComplete = () => {
    completeTask(task.id);
    toast({ title: 'Task completed', description: 'Great job!' });
  };

  const handleStartTimer = () => {
    startTimer(task.id);
    toast({ title: 'Timer started', description: 'Good luck!' });
  };

  const isOverdue = task.status === 'overdue';
  const isCompleted = task.status === 'completed';
  const canComplete = !isOverdue && !isCompleted && (!task.hasTimer || task.timerRemaining === 0);
  const canStartTimer = task.hasTimer && !task.timerStartedAt && task.status === 'pending';

  const priorityClasses = {
    low: 'priority-low',
    medium: 'priority-medium',
    high: 'priority-high',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Details</h1>
          </div>
        </div>

        {!isOverdue && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(`/tasks/${task.id}/edit`)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{task.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Overdue banner */}
      {isOverdue && (
        <div className="glass-card rounded-xl p-4 border-destructive/30 bg-destructive/10 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Overdue – Locked</p>
            <p className="text-sm text-muted-foreground">This task is past its deadline and cannot be edited or deleted.</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        {/* Title and status */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h2 className={cn(
              'text-2xl font-bold text-foreground',
              isCompleted && 'line-through opacity-60'
            )}>
              {task.title}
            </h2>
            <Badge className={cn(
              'shrink-0',
              task.status === 'pending' && 'status-pending',
              task.status === 'completed' && 'status-completed',
              task.status === 'overdue' && 'status-overdue'
            )}>
              {task.status}
            </Badge>
          </div>

          {task.description && (
            <p className="text-muted-foreground">{task.description}</p>
          )}
        </div>

        {/* Meta info grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Priority</p>
            <Badge className={cn('border', priorityClasses[task.priority])}>
              {task.priority}
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Scheduled Date</p>
            <p className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4" />
              {format(parseISO(task.scheduledDate), 'PPP')}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="flex items-center gap-2 text-foreground">
              <Tag className="h-4 w-4" />
              {task.category}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-foreground">
              {formatDistanceToNow(parseISO(task.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      {/* Timer section */}
      {task.hasTimer && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Timer</h3>
          </div>

          {task.timerStartedAt ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-mono font-bold text-foreground">{timerDisplay}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.timerRemaining === 0 ? 'Timer complete!' : 'Time remaining'}
                </p>
              </div>
              <Progress value={timerProgress} className="h-3" />
            </div>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-2xl font-semibold text-foreground">
                {Math.floor(task.timerDuration / 3600) > 0 && `${Math.floor(task.timerDuration / 3600)}h `}
                {Math.floor((task.timerDuration % 3600) / 60)}m
              </p>
              <p className="text-sm text-muted-foreground">Duration set for this task</p>
            </div>
          )}
        </div>
      )}

      {/* Deadline section */}
      {task.hasDeadline && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Deadline</h3>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-2xl font-semibold text-foreground">{task.deadlineTime}</p>
            {task.status === 'pending' && (
              <Badge variant={deadlineCountdown === 'Passed' ? 'destructive' : 'outline'}>
                {deadlineCountdown}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Recurring section */}
      {task.isRecurring && (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Recurring</h3>
          </div>

          <p className="text-foreground capitalize">{task.recurringPattern}</p>

          {task.recurringPattern === 'custom' && task.customDays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.customDays.sort().map((day) => (
                <Badge key={day} variant="secondary">
                  {WEEKDAYS[day]}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {canStartTimer && (
          <Button className="flex-1" size="lg" onClick={handleStartTimer}>
            <Play className="h-5 w-5 mr-2" />
            Start Task
          </Button>
        )}

        {canComplete && (
          <Button className="flex-1" size="lg" onClick={handleComplete}>
            <Check className="h-5 w-5 mr-2" />
            Mark as Completed
          </Button>
        )}

        {isCompleted && (
          <div className="flex-1 glass-card rounded-xl p-4 flex items-center justify-center gap-2 text-success">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Completed {task.completedAt && formatDistanceToNow(parseISO(task.completedAt), { addSuffix: true })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetail;
