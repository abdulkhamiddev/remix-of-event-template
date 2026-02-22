import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '@/types/task.ts';
import { apiFetch } from '@/lib/apiClient.ts';
import { authSession } from '@/lib/authSession.ts';

const THEME_MODE_KEY = 'theme-mode';
const SETTINGS_KEY = 'todo-app-settings';

type ThemeMode = AppSettings['theme'];
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedMode: ResolvedTheme;
  effectiveTheme: ResolvedTheme;
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

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const resolveSystemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getDomThemeMode = (): ThemeMode => {
  const rawMode = document.documentElement.dataset.themeMode;
  return isThemeMode(rawMode) ? rawMode : 'light';
};

const readStoredSettings = (): Partial<AppSettings> => {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AppSettings> | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const applyThemeToDom = (mode: ThemeMode, resolved: ResolvedTheme, profile: AppSettings['themeProfile']) => {
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
  root.setAttribute('data-theme-profile', profile || 'focus');
};

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
  const initialMode = getDomThemeMode();
  const initialResolved: ResolvedTheme = initialMode === 'system' ? resolveSystemTheme() : initialMode;

  const [settings, setSettings] = React.useState<AppSettings>(() => {
    const stored = readStoredSettings();
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      theme: initialMode,
    };
  });
  const [resolvedMode, setResolvedMode] = React.useState<ResolvedTheme>(initialResolved);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    const resolved = mode === 'system' ? resolveSystemTheme() : mode;
    setResolvedMode(resolved);

    const nextSettings = {
      ...settingsRef.current,
      theme: mode,
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);

    applyThemeToDom(mode, resolved, nextSettings.themeProfile);
    try {
      window.localStorage.setItem(THEME_MODE_KEY, mode);
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch {
      // Keep runtime state even if persistence fails.
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    const previous = settingsRef.current;
    const next: AppSettings = {
      ...previous,
      ...updates,
    };
    settingsRef.current = next;
    setSettings(next);

    if (updates.theme && updates.theme !== previous.theme) {
      setThemeMode(updates.theme);
    } else if (updates.themeProfile && updates.themeProfile !== previous.themeProfile) {
      applyThemeToDom(previous.theme, resolvedMode, updates.themeProfile);
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Keep runtime state even if persistence fails.
      }
    } else {
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Keep runtime state even if persistence fails.
      }
    }

    const patchPayload = buildSettingsPatch(updates);
    if (Object.keys(patchPayload).length === 0) return;
    if (!authSession.getState().accessToken) return;
    void apiFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patchPayload),
    }).catch(() => {
      // Keep local state; server sync can be retried from settings view.
    });
  }, [resolvedMode, setThemeMode]);

  useEffect(() => {
    applyThemeToDom(settings.theme, resolvedMode, settings.themeProfile);
  }, [settings.theme, settings.themeProfile, resolvedMode]);

  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const nextResolved = mediaQuery.matches ? 'dark' : 'light';
      setResolvedMode(nextResolved);
      applyThemeToDom('system', nextResolved, settingsRef.current.themeProfile);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  useEffect(() => {
    let active = true;

    const syncFromBackend = async () => {
      if (!authSession.getState().accessToken) return;
      try {
        const payload = await apiFetch<SettingsApiPayload>('/api/settings');
        if (!active) return;

        const previous = settingsRef.current;
        const nextTheme = isThemeMode(payload.theme) ? payload.theme : previous.theme;
        const nextResolved = nextTheme === 'system' ? resolveSystemTheme() : nextTheme;
        const nextSettings: AppSettings = {
          ...previous,
          theme: nextTheme,
          themeProfile: payload.themeProfile ?? previous.themeProfile ?? 'focus',
          sidebarCollapsed: payload.sidebarCollapsed ?? previous.sidebarCollapsed,
          animationIntensity: payload.animationIntensity ?? previous.animationIntensity,
          dateFormat: payload.dateFormat ?? previous.dateFormat,
          timeFormat: payload.timeFormat ?? previous.timeFormat,
        };

        settingsRef.current = nextSettings;
        setResolvedMode(nextResolved);
        setSettings(nextSettings);
        applyThemeToDom(nextTheme, nextResolved, nextSettings.themeProfile);
      } catch {
        // Keep local settings as fallback.
      }
    };

    void syncFromBackend();
    const unsubscribe = authSession.subscribe((state) => {
      if (!state.accessToken) return;
      void syncFromBackend();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  }, [resolvedMode, setThemeMode]);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      themeMode: settings.theme,
      setThemeMode,
      resolvedMode,
      effectiveTheme: resolvedMode,
      toggleTheme,
    }),
    [settings, updateSettings, setThemeMode, resolvedMode, toggleTheme]
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
