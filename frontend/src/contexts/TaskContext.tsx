import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Category, Task } from "@/types/task.ts";
import { apiFetch } from "@/lib/apiClient.ts";
import { useAuth } from "@/contexts/AuthContext.tsx";

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

interface TaskContextType {
  tasks: Task[];
  categories: Category[];
  isLoading: boolean;
  addTask: (task: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string, occurrenceDate?: string) => Promise<void>;
  startTimer: (id: string, occurrenceDate?: string) => Promise<void>;
  updateTimerRemaining: (id: string, remaining: number) => void;
  addCategory: (name: string) => Promise<Category>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;
  fetchTasksInRange: (start: Date, end: Date) => Promise<Task[]>;
  refreshTasks: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  getTodaysTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getTasksByDate: (date: Date) => Task[];
  getTaskById: (id: string) => Task | undefined;
}

interface CategoryResponse {
  id: string;
  name: string;
  isDefault: boolean;
}

interface CategoryInput {
  name: string;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const dateToIso = (date: Date) => format(date, "yyyy-MM-dd");

const toTaskPayload = (task: Partial<Task>, includeRequired: boolean) => {
  const payload: Record<string, unknown> = {};
  const safeStatus = task.status === "completed" ? "completed" : "pending";

  if (includeRequired || task.title !== undefined) payload.title = task.title ?? "";
  if (includeRequired || task.description !== undefined) payload.description = task.description ?? "";
  if (includeRequired || task.priority !== undefined) payload.priority = task.priority ?? "medium";
  if (includeRequired || task.scheduledDate !== undefined) payload.scheduledDate = task.scheduledDate ?? dateToIso(new Date());
  if (includeRequired || task.category !== undefined) payload.category = task.category ?? "Study";
  if (includeRequired || task.hasTimer !== undefined) payload.hasTimer = Boolean(task.hasTimer);
  if (includeRequired || task.timerDuration !== undefined) payload.timerDuration = Math.max(0, task.timerDuration ?? 0);
  if (task.timerRemaining !== undefined) payload.timerRemaining = Math.max(0, task.timerRemaining);
  if (task.timerStartedAt !== undefined) payload.timerStartedAt = task.timerStartedAt;
  if (includeRequired || task.hasDeadline !== undefined) payload.hasDeadline = Boolean(task.hasDeadline);
  if (includeRequired || task.deadlineTime !== undefined) payload.deadlineTime = task.deadlineTime ?? "";
  if (includeRequired || task.isRecurring !== undefined) payload.isRecurring = Boolean(task.isRecurring);
  if (includeRequired || task.recurringPattern !== undefined) payload.recurringPattern = task.recurringPattern ?? null;
  if (includeRequired || task.customDays !== undefined) payload.customDays = task.customDays ?? [];
  if (includeRequired || task.status !== undefined) payload.status = safeStatus;
  if (task.completedAt !== undefined) payload.completedAt = task.completedAt;

  return payload;
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshTasks = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }
    const response = await apiFetch<TaskListResponse>("/api/tasks?page=1&pageSize=500&ordering=scheduledDate");
    setTasks(response.items);
  }, [isAuthenticated]);

  const refreshCategories = useCallback(async () => {
    if (!isAuthenticated) {
      setCategories([]);
      return;
    }
    const response = await apiFetch<CategoryResponse[]>("/api/categories");
    setCategories(
      response.map((item) => ({
        id: item.id,
        name: item.name,
        isDefault: item.isDefault,
      }))
    );
  }, [isAuthenticated]);

  const fetchTasksInRange = useCallback(
    async (start: Date, end: Date): Promise<Task[]> => {
      if (!isAuthenticated) return [];
      const startIso = encodeURIComponent(dateToIso(start));
      const endIso = encodeURIComponent(dateToIso(end));
      const response = await apiFetch<TaskListResponse>(`/api/tasks?start=${startIso}&end=${endIso}`);
      return response.items;
    },
    [isAuthenticated]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isAuthenticated) {
        setTasks([]);
        setCategories([]);
        return;
      }
      setIsLoading(true);
      try {
        const [taskResponse, categoryResponse] = await Promise.all([
          apiFetch<TaskListResponse>("/api/tasks?page=1&pageSize=500&ordering=scheduledDate"),
          apiFetch<CategoryResponse[]>("/api/categories"),
        ]);
        if (!active) return;
        setTasks(taskResponse.items);
        setCategories(
          categoryResponse.map((item) => ({
            id: item.id,
            name: item.name,
            isDefault: item.isDefault,
          }))
        );
      } catch (error) {
        console.error("Failed to load tasks/categories:", error);
        if (active) {
          setTasks([]);
          setCategories([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const addTask = useCallback(async (taskData: Partial<Task>): Promise<Task> => {
    const created = await apiFetch<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(toTaskPayload(taskData, true)),
    });
    setTasks((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
    return created;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const updated = await apiFetch<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(toTaskPayload(updates, false)),
    });
    setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const completeTask = useCallback(async (id: string, occurrenceDate?: string) => {
    const query = occurrenceDate ? `?date=${encodeURIComponent(occurrenceDate)}` : "";
    const updated = await apiFetch<Task>(`/api/tasks/${id}/complete${query}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
    await refreshTasks();
  }, [refreshTasks]);

  const startTimer = useCallback(async (id: string, occurrenceDate?: string) => {
    const query = occurrenceDate ? `?date=${encodeURIComponent(occurrenceDate)}` : "";
    const updated = await apiFetch<Task>(`/api/tasks/${id}/start-timer${query}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setTasks((prev) => prev.map((task) => (task.id === id ? updated : task)));
    await refreshTasks();
  }, [refreshTasks]);

  const updateTimerRemaining = useCallback((id: string, remaining: number) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        return { ...task, timerRemaining: Math.max(0, remaining) };
      })
    );
  }, []);

  const addCategory = useCallback(async (name: string): Promise<Category> => {
    const trimmed = name.trim();
    const created = await apiFetch<CategoryResponse>("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: trimmed } as CategoryInput),
    });
    const next: Category = { id: created.id, name: created.name, isDefault: created.isDefault };
    setCategories((prev) => [...prev, next]);
    return next;
  }, []);

  const updateCategory = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    const updated = await apiFetch<CategoryResponse>(`/api/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed } as CategoryInput),
    });
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { id: updated.id, name: updated.name, isDefault: updated.isDefault } : cat))
    );
    await refreshTasks();
  }, [refreshTasks]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    const category = categories.find((item) => item.id === id);
    if (!category || category.isDefault) return false;
    await apiFetch<void>(`/api/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((item) => item.id !== id));
    await refreshTasks();
    return true;
  }, [categories, refreshTasks]);

  const getTodaysTasks = useCallback((): Task[] => {
    const today = dateToIso(new Date());
    return tasks.filter((task) => task.scheduledDate === today);
  }, [tasks]);

  const getOverdueTasks = useCallback((): Task[] => {
    return tasks.filter((task) => task.status === "overdue");
  }, [tasks]);

  const getTasksByDate = useCallback(
    (date: Date): Task[] => {
      const dateStr = dateToIso(date);
      return tasks.filter((task) => task.scheduledDate === dateStr);
    },
    [tasks]
  );

  const getTaskById = useCallback((id: string): Task | undefined => {
    return tasks.find((task) => task.id === id);
  }, [tasks]);

  const value = useMemo(
    () => ({
      tasks,
      categories,
      isLoading,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      startTimer,
      updateTimerRemaining,
      addCategory,
      updateCategory,
      deleteCategory,
      fetchTasksInRange,
      refreshTasks,
      refreshCategories,
      getTodaysTasks,
      getOverdueTasks,
      getTasksByDate,
      getTaskById,
    }),
    [
      tasks,
      categories,
      isLoading,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      startTimer,
      updateTimerRemaining,
      addCategory,
      updateCategory,
      deleteCategory,
      fetchTasksInRange,
      refreshTasks,
      refreshCategories,
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
    throw new Error("useTaskContext must be used within a TaskProvider");
  }
  return context;
};
