import React, { createContext, useContext, useCallback, useMemo, useEffect } from 'react';
import { Task, Category, DEFAULT_CATEGORIES, createNewTask } from '@/types/task';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isToday, isBefore, startOfDay, parseISO, format } from 'date-fns';

interface TaskContextType {
  tasks: Task[];
  categories: Category[];
  addTask: (task: Partial<Task>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  startTimer: (id: string) => void;
  updateTimerRemaining: (id: string, remaining: number) => void;
  addCategory: (name: string) => Category;
  updateCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => boolean;
  getTodaysTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getTasksByDate: (date: Date) => Task[];
  getTaskById: (id: string) => Task | undefined;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useLocalStorage<Task[]>('todo-app-tasks', []);
  const [categories, setCategories] = useLocalStorage<Category[]>('todo-app-categories', DEFAULT_CATEGORIES);

  const isPastDateString = (dateStr: string) => {
    const parsed = parseISO(dateStr);
    return isBefore(parsed, startOfDay(new Date()));
  };

  // Check and update overdue tasks
  useEffect(() => {
    const checkOverdueTasks = () => {
      const now = new Date();
      const today = startOfDay(now);
      
      setTasks((prevTasks) => 
        prevTasks.map((task) => {
          if (task.status === 'completed') return task;
          
          const taskDate = parseISO(task.scheduledDate);
          const isOverdue = isBefore(taskDate, today) || 
            (isToday(taskDate) && task.hasDeadline && task.deadlineTime && (() => {
              const [hours, minutes] = task.deadlineTime.split(':').map(Number);
              const deadline = new Date(taskDate);
              deadline.setHours(hours, minutes, 0, 0);
              return isBefore(deadline, now);
            })());
          
          if (isOverdue && task.status !== 'overdue') {
            return { ...task, status: 'overdue' as const };
          }
          return task;
        })
      );
    };

    checkOverdueTasks();
    const interval = setInterval(checkOverdueTasks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [setTasks]);

  const addTask = useCallback((taskData: Partial<Task>): Task => {
    const todayStr = new Date().toISOString().split('T')[0];
    const safeScheduledDate =
      taskData.scheduledDate && isPastDateString(taskData.scheduledDate)
        ? todayStr
        : taskData.scheduledDate;
    const newTask = createNewTask({ ...taskData, scheduledDate: safeScheduledDate });
    setTasks((prev) => [...prev, newTask]);
    return newTask;
  }, [setTasks]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        // Prevent editing overdue tasks
        if (task.status === 'overdue') return task;
        if (updates.scheduledDate && isPastDateString(updates.scheduledDate)) {
          const { scheduledDate, ...rest } = updates;
          return { ...task, ...rest };
        }
        return { ...task, ...updates };
      })
    );
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      // Prevent deleting overdue tasks
      if (task?.status === 'overdue') return prev;
      return prev.filter((t) => t.id !== id);
    });
  }, [setTasks]);

  const completeTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        if (task.status === 'overdue') return task;
        
        // Check timer constraint
        if (task.hasTimer && task.timerRemaining > 0) return task;
        
        return {
          ...task,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
        };
      })
    );
  }, [setTasks]);

  const startTimer = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        if (!task.hasTimer || task.timerStartedAt) return task;
        return {
          ...task,
          timerStartedAt: new Date().toISOString(),
          timerRemaining: task.timerDuration,
        };
      })
    );
  }, [setTasks]);

  const updateTimerRemaining = useCallback((id: string, remaining: number) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        return { ...task, timerRemaining: Math.max(0, remaining) };
      })
    );
  }, [setTasks]);

  const addCategory = useCallback((name: string): Category => {
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name,
      isDefault: false,
    };
    setCategories((prev) => [...prev, newCategory]);
    return newCategory;
  }, [setCategories]);

  const updateCategory = useCallback((id: string, name: string) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, name } : cat))
    );
  }, [setCategories]);

  const deleteCategory = useCallback((id: string): boolean => {
    const category = categories.find((c) => c.id === id);
    if (!category || category.isDefault) return false;
    
    setCategories((prev) => prev.filter((c) => c.id !== id));
    // Move tasks with deleted category to default
    setTasks((prev) =>
      prev.map((task) =>
        task.category === category.name ? { ...task, category: 'Study' } : task
      )
    );
    return true;
  }, [categories, setCategories, setTasks]);

  const getTodaysTasks = useCallback((): Task[] => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter((task) => task.scheduledDate === today);
  }, [tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    return tasks.filter((task) => task.status === 'overdue');
  }, [tasks]);

  const getTasksByDate = useCallback((date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((task) => task.scheduledDate === dateStr);
  }, [tasks]);

  const getTaskById = useCallback((id: string): Task | undefined => {
    return tasks.find((task) => task.id === id);
  }, [tasks]);

  const value = useMemo(
    () => ({
      tasks,
      categories,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      startTimer,
      updateTimerRemaining,
      addCategory,
      updateCategory,
      deleteCategory,
      getTodaysTasks,
      getOverdueTasks,
      getTasksByDate,
      getTaskById,
    }),
    [
      tasks,
      categories,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      startTimer,
      updateTimerRemaining,
      addCategory,
      updateCategory,
      deleteCategory,
      getTodaysTasks,
      getOverdueTasks,
      getTasksByDate,
      getTaskById,
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};
