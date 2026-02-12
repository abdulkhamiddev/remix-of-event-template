import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '@/types/task.ts';
import { useLocalStorage } from '@/hooks/useLocalStorage.ts';
import { apiFetch } from '@/lib/apiClient.ts';
import { authStorage } from '@/lib/authStorage.ts';

interface ThemeContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  effectiveTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface SettingsApiPayload {
  theme?: AppSettings['theme'];
  themeProfile?: AppSettings['themeProfile'];
  sidebarCollapsed?: boolean;
  animationIntensity?: AppSettings['animationIntensity'];
  dateFormat?: AppSettings['dateFormat'];
  timeFormat?: AppSettings['timeFormat'];
}

const buildSettingsPatch = (updates: Partial<AppSettings>): Partial<SettingsApiPayload> => {
  const patch: Partial<SettingsApiPayload> = {};
  if ('theme' in updates && updates.theme) patch.theme = updates.theme;
  if ('themeProfile' in updates && updates.themeProfile) patch.themeProfile = updates.themeProfile;
  if ('sidebarCollapsed' in updates && typeof updates.sidebarCollapsed === 'boolean') patch.sidebarCollapsed = updates.sidebarCollapsed;
  if ('animationIntensity' in updates && updates.animationIntensity) patch.animationIntensity = updates.animationIntensity;
  if ('dateFormat' in updates && updates.dateFormat) patch.dateFormat = updates.dateFormat;
  if ('timeFormat' in updates && updates.timeFormat) patch.timeFormat = updates.timeFormat;
  return patch;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useLocalStorage<AppSettings>('todo-app-settings', DEFAULT_SETTINGS);

  const effectiveTheme = useMemo(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    let active = true;

    const syncFromBackend = async () => {
      if (!authStorage.getState().accessToken) return;
      try {
        const payload = await apiFetch<SettingsApiPayload>('/api/settings');
        if (!active) return;
        setSettings((prev) => ({
          ...prev,
          theme: payload.theme ?? prev.theme,
          themeProfile: payload.themeProfile ?? prev.themeProfile ?? 'focus',
          sidebarCollapsed: payload.sidebarCollapsed ?? prev.sidebarCollapsed,
          animationIntensity: payload.animationIntensity ?? prev.animationIntensity,
          dateFormat: payload.dateFormat ?? prev.dateFormat,
          timeFormat: payload.timeFormat ?? prev.timeFormat,
        }));
      } catch (_error) {
        // Keep local settings as fallback.
      }
    };

    void syncFromBackend();
    const unsubscribe = authStorage.subscribe((state) => {
      if (!state.accessToken) return;
      void syncFromBackend();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setSettings]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    root.setAttribute('data-theme-profile', settings.themeProfile || 'focus');
  }, [effectiveTheme, settings.themeProfile]);

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
    const patchPayload = buildSettingsPatch(updates);
    if (Object.keys(patchPayload).length === 0) return;
    if (!authStorage.getState().accessToken) return;
    void apiFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patchPayload),
    }).catch(() => {
      // Keep local state; server sync can be retried from settings view.
    });
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
