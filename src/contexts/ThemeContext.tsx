import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '@/types/task';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ThemeContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  effectiveTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useLocalStorage<AppSettings>('todo-app-settings', DEFAULT_SETTINGS);

  const effectiveTheme = useMemo(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const toggleTheme = () => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  };

  const value = useMemo(
    () => ({ settings, updateSettings, effectiveTheme, toggleTheme }),
    [settings, effectiveTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
