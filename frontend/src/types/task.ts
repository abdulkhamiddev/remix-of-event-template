export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type RecurringPattern = 'daily' | 'monthly' | 'yearly' | 'custom';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  scheduledDate: string; // ISO date string
  category: string;
  hasTimer: boolean;
  timerDuration: number; // in seconds
  timerRemaining: number; // in seconds
  timerStartedAt: string | null; // ISO date string
  hasDeadline: boolean;
  deadlineTime: string; // HH:MM format
  isRecurring: boolean;
  recurringPattern: RecurringPattern | null;
  customDays: number[]; // 0-6 for Sunday-Saturday
  status: TaskStatus;
  createdAt: string; // ISO date string
  completedAt: string | null; // ISO date string
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  themeProfile: 'focus' | 'calm' | 'energy';
  sidebarCollapsed: boolean;
  animationIntensity: 'full' | 'reduced';
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'default-study', name: 'Study', isDefault: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  themeProfile: 'focus',
  sidebarCollapsed: false,
  animationIntensity: 'full',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
};

export const createNewTask = (partial: Partial<Task>): Task => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  priority: 'medium',
  scheduledDate: new Date().toISOString().split('T')[0],
  category: 'Study',
  hasTimer: false,
  timerDuration: 0,
  timerRemaining: 0,
  timerStartedAt: null,
  hasDeadline: false,
  deadlineTime: '',
  isRecurring: false,
  recurringPattern: null,
  customDays: [],
  status: 'pending',
  createdAt: new Date().toISOString(),
  completedAt: null,
  ...partial,
});
